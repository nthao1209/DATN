import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Route, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildTripColumns } from './trip/columns';
import { useTheme } from '../theme/ThemeContext';
import type { TripRow } from './trip/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const TripPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- DATA FETCHING ---
  const { data: trips = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  useEffect(() => {
    const mapped: TripRow[] = trips.map((t: any) => ({
      id: Number(t.id),
      localId: `db_${t.id}`,
      name: t.name || '',
      status: t.status === 'DONE' ? 'DONE' : 'DOING',
      busCount: Number(t?._count?.buses || 0),
      roundCount: Number(t?._count?.rounds || 0),
    }));

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({ localId: makeLocalId(), name: '', status: 'DOING', busCount: 0, roundCount: 0 });
    }
    setRows(padded);
  }, [trips]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.name.trim()).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof TripRow>(localId: string, key: K, value: TripRow[K]) => {
    setRows((prev) => prev.map((row) => row.localId === localId ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) } : row));
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { localId: makeLocalId(), name: '', status: 'DOING', busCount: 0, roundCount: 0 }]);
  };

  const handleDeleteRow = (row: TripRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim());
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);
    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) return;

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((r) => api.createTrip({ name: r.name.trim(), status: r.status })),
        ...rowsToUpdate.map((r) => api.updateTrip(String(r.id), { name: r.name.trim(), status: r.status })),
        ...deletedIds.map((id) => api.deleteTrip(String(id))),
      ]);
      setDeletedIds([]); await refetch(); enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const columns = buildTripColumns({
    handleCellChange,
    handleDeleteRow,
    onManageBuses: (id) => navigate(`/trips/${id}/buses`),
    onManageRounds: (id) => navigate(`/trips/${id}/rounds`),
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 trip-page">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
            style={{ 
              width: '42px', height: '42px', 
              backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
              border: `1px solid ${colors.primary}33`
            }}
          >
            <Route size={20} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Quản lý Lộ trình</h1>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => { setDeletedIds([]); refetch(); }}
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Toolbar - Gọn & Thanh thoát */}
      <div 
        className="p-2 mb-4 d-flex justify-content-end align-items-center gap-2 px-3 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.md,
          border: `1px solid ${colors.border}`,
        }}
      >
        <button 
          className="btn-custom-action-small" 
          onClick={handleAddRow}
          style={{ color: colors.primary, border: `1px solid ${colors.primary}44` }}
        >
          <Plus size={16} /> 
          <span className="d-none d-sm-inline">Thêm dòng</span>
        </button>

        <button
          className="btn-custom-action-save shadow-sm"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          style={{ 
            backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight, 
            color: dirtyCount > 0 ? '#fff' : colors.textMuted,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          <Save size={16} />
          <span className="d-none d-sm-inline">
            {isSaving ? 'Đang lưu...' : `Lưu thay đổi (${dirtyCount})`}
          </span>
          <span className="d-inline d-sm-none">{dirtyCount}</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách lộ trình"
          columns={columns}
          queryKey={['trips-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
        />
      </div>

      <style>{`
        /* Ô nhập liệu sắc nét */
        .trip-page .td-content input, 
        .trip-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .trip-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Nút Action Gọn */
        .btn-custom-action-small, .btn-custom-action-save {
          display: flex; align-items: center; gap: 6px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; border-radius: 8px; border: none; transition: all 0.2s;
          background: transparent; cursor: pointer;
        }

        .btn-custom-action-small:hover { background: ${colors.primary}11; transform: translateY(-1px); }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s; cursor: pointer; border: none;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Header Bảng nhẹ nhàng cho Light Mode */
        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#64748b'} !important;
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
          .trip-page h1 { font-size: 1.15rem; }
          .btn-custom-action-small, .btn-custom-action-save { padding: 6px 12px; }
        }
      `}</style>
    </div>
  );
};

export default TripPage;