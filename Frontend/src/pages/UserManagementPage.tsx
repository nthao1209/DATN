import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Users, RefreshCw } from 'lucide-react';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { format } from 'date-fns';
import { buildUserColumns } from './user-management/columns';
import { useTheme } from '../theme/ThemeContext'; // Import useTheme
import type { UserRow } from './user-management/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const UserManagementPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); 
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const initialRowsByIdRef = useRef<Record<number, UserRow>>({});

  const initializedRef = useRef(false);

  const { data: users = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['users-management'],
    queryFn: () => api.get('/users'),
  });

  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
  });

  useEffect(() => {
    // Wait until initial fetch finishes. Avoid mapping on initial empty-array placeholder.
    if (isLoading) return;
    if (initializedRef.current) return;

    const mapped: UserRow[] = users.map((user: any) => ({
      id: Number(user.id),
      localId: `db_${user.id}`,
      email: user.email || '',
      name: user.name || '',
      createdDate: user.createdDate ? format(new Date(user.createdDate), 'dd/MM/yyyy') : '',
      latestAccessDate: user.lastAccessAt ? format(new Date(user.lastAccessAt), 'dd/MM/yyyy HH:mm') : 'Chưa có',
      latestRole: user.latestRole || user.userTenants?.[0]?.role?.name || 'N/A',
      description: user.description || '',
      roleId: user.userTenants?.[0]?.role?.id ?? null,
      tenantId: user.userTenants?.[0]?.tenant?.id ?? null,
      isEdited: false,
    }));

    const initialById: Record<number, UserRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        email: '',
        name: '',
        createdDate: '',
        latestAccessDate: '',
        latestRole: '',
        description: '',
        roleId: null,
        tenantId: null,
      });
    }

    setRows(padded);
    initializedRef.current = true;
  }, [users, isLoading]);

  const isSameRow = (current: UserRow, initial: UserRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      (current.description || '').trim() === (initial.description || '').trim() &&
      (current.roleId ?? null) === (initial.roleId ?? null) &&
      (current.tenantId ?? null) === (initial.tenantId ?? null)
    );
  };

  const isRowDirty = (row: UserRow) => {
    if (!row.id) return false;
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.id && isRowDirty(r)).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof UserRow>(localId: string, key: K, value: UserRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const nextRow = { ...row, [key]: value };
        if (!row.id) return nextRow;
        const initial = initialRowsByIdRef.current[row.id];
        const isEdited = initial ? !isSameRow(nextRow, initial) : true;
        return { ...nextRow, isEdited };
      })
    );
  };

  const handleDeleteRow = (row: UserRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToUpdate = rows.filter((r) => r.id && isRowDirty(r));

    if (!rowsToUpdate.length && !deletedIds.length) {
      enqueueSnackbar('Không có thay đổi nào', { variant: 'info' });
      return;
    }

    try {
      setIsSaving(true);
      const warnings: string[] = [];

      await Promise.all([
        ...rowsToUpdate.map((r) => {
          const isSystemAdmin = (r.latestRole || '').toLowerCase() === 'system_admin';
          const payload: any = {
            name: r.name.trim(),
            description: r.description?.trim() || null,
          };

          // Only allow role changes between 'admin' and 'busmanagement'. Never allow any change to/from system_admin.
          if (!isSystemAdmin && r.roleId !== undefined && r.roleId !== null) {
            const roleObj = (roles || []).find((rr: any) => Number(rr.id) === Number(r.roleId));
            const newRoleName = (roleObj?.name || '').toLowerCase();
            const oldRoleName = (r.latestRole || '').toLowerCase();
            const allowed = ['admin', 'busmanagement'];

            if (newRoleName === 'system_admin' || oldRoleName === 'system_admin') {
              warnings.push(`Không thể gán hoặc gỡ vai trò 'system_admin' cho ${r.email}`);
            } else if (allowed.includes(oldRoleName) && allowed.includes(newRoleName)) {
              payload.roleId = r.roleId;
              payload.tenantId = r.tenantId;
            } else {
              warnings.push(`Chỉ được đổi giữa 'admin' và 'busmanagement' cho ${r.email}`);
            }
          }

          return api.put(`/users/${r.id}`, payload);
        }),
        ...deletedIds.map((id) => api.delete(`/users/${id}`)),
      ]);

      if (warnings.length) {
        enqueueSnackbar(warnings.join('; '), { variant: 'warning' });
      }
      initializedRef.current = false;
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildUserColumns({
    handleCellChange,
    handleDeleteRow,
    roles: roles || [],
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 user-management-page">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
            style={{ 
              width: '42px', 
              height: '42px', 
              backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
              border: `1px solid ${colors.primary}33`
            }}
          >
            <Users size={22} style={{ color: colors.primary }} />
          </div>
          <div>
            <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
              Quản lý Tài khoản
            </h1>
          </div>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => {
            initializedRef.current = false;
            setDeletedIds([]);
            refetch();
          }}
          title="Làm mới dữ liệu"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      
      {/* Main Table Card */}
      <div 
        className="table-container-card shadow-sm" 
        style={{ 
          backgroundColor: colors.surface, 
          borderRadius: effects.borderRadius.lg, 
          border: `1px solid ${colors.border}`, 
          overflow: 'hidden' 
        }}
      >
        <DataTable
          title="Danh sách tài khoản"
          titleActions={
            <button
              className="btn-custom-action-save shadow-sm"
              onClick={handleSave}
              disabled={isSaving || dirtyCount === 0}
              style={{ 
                backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight, 
                color: dirtyCount > 0 ? '#fff' : colors.textMuted
              }}
            >
              <Save size={16} />
              <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
              <span className="d-inline d-sm-none">{dirtyCount}</span>
            </button>
          }         
          columns={columns}
          queryKey={['users-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => {
            initializedRef.current = false;
            setDeletedIds([]);
            refetch();
          }}
        />      
      </div>

      <style>{`
        /* Ô nhập liệu tinh tế & sắc nét */
        .user-management-page .td-content input, 
        .user-management-page .td-content select {
          min-height: 38px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13.5px !important;
          transition: all 0.2s;
        }
        
        .user-management-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Nút Lưu gọn & Hiệu ứng lún */
        .btn-custom-action-save {
          display: flex; align-items: center; gap: 6px; padding: 6px 16px;
          font-size: 13.5px; font-weight: 600; border-radius: 8px; border: none; transition: all 0.2s;
          background: transparent;
        }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s; border: none; cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Table Header nhẹ nhàng cho Light Mode */
        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#475569'} !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 12px !important;
          border-bottom: 1px solid ${colors.border} !important;
          font-weight: 700 !important;
        }
          .user-management-page .btn-action-delete {
          /* Ép kích thước và layout */
          width: 36px !important;
          height: 36px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;          
          border-radius: 10px !important;
          border: 1px solid rgba(220, 53, 69, 0.2) !important;
          background-color: rgba(220, 53, 69, 0.05) !important;
          color: #dc3545 !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          cursor: pointer !important;
          outline: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .user-management-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .user-management-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .user-management-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .user-management-page h1 { font-size: 1.15rem; }
          .btn-custom-action-save { padding: 6px 12px; }
        }
      `}</style>
    </div>
  );
};

export default UserManagementPage;