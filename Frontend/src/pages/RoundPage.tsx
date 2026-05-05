import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Map, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildRoundColumns } from './round/columns';
import { useTheme } from '../theme/ThemeContext'; 
import type { RoundRow } from './round/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const RoundPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- DATA FETCHING ---
  const { data: rounds = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['rounds', tripId],
    queryFn: () => api.getRounds(String(tripId)),
    enabled: !!tripId,
  });

  useEffect(() => {
    const mapped: RoundRow[] = rounds.map((r: any) => ({
      id: Number(r.id),
      localId: `db_${r.id}`,
      name: r.name || '',
      time: r.time || '',
      status: r.status === 'DONE' ? 'DONE' : 'DOING',
      transactionCount: Number(r?._count?.transactions || 0),
      passengerCount: Number(r?.passengerCount || 0),
    }));

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        time: '',
        status: 'DOING',
        transactionCount: 0,
        passengerCount: 0,
      });
    }
    setRows(padded);
  }, [rounds]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.name.trim() && r.time.trim()).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof RoundRow>(localId: string, key: K, value: RoundRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) }
          : row
      )
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        name: '',
        time: '',
        status: 'DOING',
        transactionCount: 0,
        passengerCount: 0,
      },
    ]);
  };

  const handleDeleteRow = (row: RoundRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (!tripId) return;
    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim() && r.time.trim());
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((r) => api.createRound(tripId, { name: r.name.trim(), time: r.time.trim(), status: r.status })),
        ...rowsToUpdate.map((r) => api.updateRound(String(r.id), { name: r.name.trim(), time: r.time.trim(), status: r.status })),
        ...deletedIds.map((id) => api.deleteRound(String(id))),
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

  const columns = buildRoundColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 round-page">
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
            <Map size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
            Quản lý Chặng đi
          </h1>
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

      {/* Toolbar Section */}
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

      {/* Table Section */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách các chặng"
          columns={columns}
          queryKey={['rounds-local', tripId]}
          data={rows}
          isLoading={isLoading}
          isError={isError}
        />
      </div>

      <style>{`
        /* Ô nhập liệu trong bảng */
        .round-page .td-content input, 
        .round-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .round-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Nút Action Gọn hơn */
        .btn-custom-action-small, .btn-custom-action-save {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
        }

        .btn-custom-action-small:hover { background: ${colors.primary}11; transform: translateY(-1px); }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .btn-refresh-custom {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Sửa Header Bảng */
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
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .round-page h1 { font-size: 1.15rem; }
          .btn-custom-action-small, .btn-custom-action-save { padding: 6px 12px; }
        }
      `}</style>
    </div>
  );
};

export default RoundPage;