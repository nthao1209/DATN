import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const initialRowsByIdRef = useRef<Record<number, RoundRow>>({});

  // --- DATA FETCHING ---
  const { data: rounds = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['rounds', tripId],
    queryFn: () => api.getRounds(String(tripId)),
    enabled: !!tripId,
  });

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ['round-transactions', tripId],
    queryFn: () => api.getTransactions(),
    enabled: !!tripId,
  });

  useEffect(() => {
    const mapped: RoundRow[] = rounds.map((r: any) => ({
      id: Number(r.id),
      localId: `db_${r.id}`,
      name: r.name || '',
      time: r.time || '',
      status: r.status === 'DONE' ? 'DONE' : 'DOING',
      // transactionCount here represents number of check-ins for compatibility with existing UI
      transactionCount: Number(
        (transactions || []).filter((tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === Number(r.id) && Boolean(tx.checkIn)).length
      ),
      checkInCount: Number(
        (transactions || []).filter((tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === Number(r.id) && Boolean(tx.checkIn)).length
      ),
      checkOutCount: Number(
        (transactions || []).filter((tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === Number(r.id) && Boolean(tx.checkOut)).length
      ),
      passengerCount: Number(r?.passengerCount || 0),
    }));

    const initialById: Record<number, RoundRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

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

  const isSameRow = (current: RoundRow, initial: RoundRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      current.time.trim() === initial.time.trim() &&
      current.status === initial.status
    );
  };

  const isNewRowDirty = (row: RoundRow) => {
    return Boolean(row.name.trim() || row.time.trim() || row.status !== 'DOING');
  };

  const isRowDirty = (row: RoundRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && isNewRowDirty(r)).length;
    const edited = rows.filter((r) => r.id && isRowDirty(r)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof RoundRow>(localId: string, key: K, value: RoundRow[K]) => {
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
    const rowsToUpdate = rows.filter((r) => r.id && isRowDirty(r));

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


      {/* Table Section */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách các chặng"
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
          queryKey={['rounds-local', tripId]}
          data={rows}
          isLoading={isLoading}
          isError={isError}
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
        .icon-header-box {
          width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
          border-radius: 50%; border: 1px solid ${colors.primary}33; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .btn-custom-action-save {
          display: flex; align-items: center; gap: 8px; padding: 6px 16px;
          font-size: 13px; font-weight: 700; border-radius: 8px; border: none;
          transition: all 0.2s ease;
        }
        .btn-custom-action-save:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }

        .btn-add-row-bottom {
          display: flex; align-items: center; justify-content: center;
          background: transparent; transition: all 0.2s;
        }
        .btn-add-row-bottom:hover {
          background-color: ${colors.primary}15 !important;
          border-style: solid !important;
          transform: scale(1.005);
        }
        
        .round-page .td-content input, .round-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important; font-size: 13px !important;
        }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: 0.2s; cursor: pointer; border: none;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#475569'} !important;
          font-size: 12px !important; text-transform: uppercase !important;
          padding: 12px !important; font-weight: 700 !important;
          border-bottom: 1px solid ${colors.border} !important;
        }
          
        .round-page .btn-action-delete {
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

        .round-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .round-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .round-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default RoundPage;