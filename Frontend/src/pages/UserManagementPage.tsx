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
  const { colors, effects, isDarkMode } = useTheme(); // Sử dụng theme
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const initializedRef = useRef(false);

  const { data: users = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['users-management'],
    queryFn: () => api.get('/users'),
  });

  useEffect(() => {
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
      isEdited: false,
    }));

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
      });
    }

    setRows(padded);
    initializedRef.current = true;
  }, [users]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.isEdited).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof UserRow>(localId: string, key: K, value: UserRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) }
          : row
      )
    );
  };

  const handleDeleteRow = (row: UserRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    if (!rowsToUpdate.length && !deletedIds.length) {
      enqueueSnackbar('Không có thay đổi nào', { variant: 'info' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToUpdate.map((r) =>
          api.put(`/users/${r.id}`, {
            name: r.name.trim(),
            description: r.description?.trim() || null,
          })
        ),
        ...deletedIds.map((id) => api.delete(`/users/${id}`)),
      ]);
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

      {/* Toolbar Section - Tinh gọn, dồn phải */}
      <div className="d-flex justify-content-end align-items-center gap-2 mb-4 px-2">
        <button
          className="btn-custom-action-save shadow-sm"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          style={{
            backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight,
            color: dirtyCount > 0 ? '#fff' : colors.textMuted,
            opacity: isSaving ? 0.7 : 1,
            cursor: dirtyCount > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          <Save size={16} /> 
          <span className="d-none d-sm-inline">
            {isSaving ? 'Đang lưu...' : `Lưu thay đổi (${dirtyCount})`}
          </span>
          <span className="d-inline d-sm-none">{dirtyCount}</span>
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