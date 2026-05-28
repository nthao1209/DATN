import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Shield} from 'lucide-react';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { buildRoleColumns } from './role-management/columns';
import { useTheme } from '../../theme/ThemeContext'; // Import useTheme
import type { RoleRow } from './role-management/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 3;

const RoleManagementPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); // Sử dụng theme
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, RoleRow>>({});

  const { data: roles = [], isLoading, isError, refetch} = useQuery<any[]>({
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

    const initialById: Record<number, RoleRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

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

  const isSameRow = (current: RoleRow, initial: RoleRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      current.description.trim() === initial.description.trim()
    );
  };

  const isNewRowDirty = (row: RoleRow) => {
    return Boolean(row.name.trim() || row.description.trim());
  };

  // Remove empty role rows on unmount and prevent duplicate empty rows
  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: RoleRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(
    () => rows.filter((r) => (r.id ? isRowDirty(r) : isNewRowDirty(r))).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof RoleRow>(localId: string, key: K, value: RoleRow[K]) => {
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

  const handleAddRow = () => {
    setRows((prev) => {
      const hasEmptyNew = prev.some((r) => !r.id && !isNewRowDirty(r));
      if (hasEmptyNew) {
        const emptyRow = prev.find((r) => !r.id && !isNewRowDirty(r));
        if (emptyRow) {
          setFocusRowKey(emptyRow.localId);
          setFocusRowSignal((value) => value + 1);
        }
        return prev;
      }

      const localId = makeLocalId();
      setFocusRowKey(localId);
      setFocusRowSignal((value) => value + 1);
      return [
        ...prev,
        {
          localId,
          name: '',
          description: '',
        },
      ];
    });
  };

  const handleDeleteRow = (row: RoleRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const newRows = rows.filter((r) => !r.id && r.name.trim());
    const updateRows = rows.filter((r) => r.id && isRowDirty(r));

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
          </div>
        </div>
        
        {/* refresh button removed */}
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
          queryKey={['roles-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
          onRefresh={() => {
            setDeletedIds([]);
            refetch();
          }}
        />
        <div className="p-3 border-top" style={{ borderColor: colors.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fcfcfc' }}>
          <button 
            className="btn-add-row-bottom w-100 py-2" 
            onClick={handleAddRow}
            style={{ 
              color: colors.primary, 
              border: `1px dashed ${colors.primary}66`,
              borderRadius: '8px',
              backgroundColor: `${colors.primary}08`
            }}
          >
            <Plus size={18} />
            <span className="fw-bold ms-2">Thêm dòng mới</span>
          </button>
        </div>
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

        /* refresh button styles removed */

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
        .role-management-page .btn-action-delete {
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

        .role-management-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .role-management-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .role-management-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
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