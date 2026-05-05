import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Shield, RefreshCw } from 'lucide-react';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildRoleColumns } from './role-management/columns';
import { useTheme } from '../theme/ThemeContext'; // Import useTheme
import type { RoleRow } from './role-management/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 3;

const RoleManagementPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); // Sử dụng theme
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: roles = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['roles-management'],
    queryFn: () => api.get('/roles'),
  });

  useEffect(() => {
    const mapped: RoleRow[] = roles.map((role: any) => ({
      id: Number(role.id),
      localId: `db_${role.id}`,
      name: role.name || '',
      description: role.description || '',
      isEdited: false,
    }));

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        description: '',
      });
    }
    setRows(padded);
  }, [roles]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.isEdited || (!r.id && r.name.trim())).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof RoleRow>(localId: string, key: K, value: RoleRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) }
          : row
      )
    );
  };

  const handleAddNewRow = () => {
    setRows((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        name: '',
        description: '',
      },
    ]);
  };

  const handleDeleteRow = (row: RoleRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const newRows = rows.filter((r) => !r.id && r.name.trim());
    const updateRows = rows.filter((r) => r.id && r.isEdited);

    if (!newRows.length && !updateRows.length && !deletedIds.length) {
      enqueueSnackbar('Không có thay đổi nào', { variant: 'info' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...newRows.map((r) =>
          api.post('/roles', {
            name: r.name.trim(),
            description: r.description.trim() || null,
          })
        ),
        ...updateRows.map((r) =>
          api.put(`/roles/${r.id}`, {
            name: r.name.trim(),
            description: r.description.trim() || null,
          })
        ),
        ...deletedIds.map((id) => api.delete(`/roles/${id}`)),
      ]);
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildRoleColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 role-management-page">
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
            <Shield size={22} style={{ color: colors.primary }} />
          </div>
          <div>
            <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
              Quản lý Vai trò
            </h1>
            <div className="text-muted small">Định nghĩa quyền hạn người dùng</div>
          </div>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => { setDeletedIds([]); refetch(); }}
          title="Làm mới dữ liệu"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Toolbar Section - Tinh gọn, bỏ khung trắng */}
      <div className="d-flex justify-content-end align-items-center gap-2 mb-4 px-2">
        <button
          className="btn-custom-action-small"
          onClick={handleAddNewRow}
          style={{ color: colors.primary, border: `1px solid ${colors.primary}44` }}
        >
          <Plus size={16} /> 
          <span className="d-none d-sm-inline">Thêm vai trò</span>
        </button>
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
          title="Danh sách vai trò"
          columns={columns}
          queryKey={['roles-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => {
            setDeletedIds([]);
            refetch();
          }}
        />
      </div>

      <style>{`
        /* Ô nhập liệu sắc nét */
        .role-management-page .td-content input, 
        .role-management-page .td-content select {
          min-height: 38px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13.5px !important;
          transition: all 0.2s;
        }
        
        .role-management-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Nút bấm Gọn & Hiệu ứng lún */
        .btn-custom-action-small, .btn-custom-action-save {
          display: flex; align-items: center; gap: 6px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; border-radius: 8px; border: none; transition: all 0.2s;
          background: transparent;
        }
        .btn-custom-action-small:hover { background: ${colors.primary}11; transform: translateY(-1px); }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s; border: none; cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Table Header Light Mode */
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
          .role-management-page h1 { font-size: 1.15rem; }
          .btn-custom-action-small, .btn-custom-action-save { padding: 6px 12px; }
        }
      `}</style>
    </div>
  );
};

export default RoleManagementPage;