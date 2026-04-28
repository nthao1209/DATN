import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Map, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildRoundColumns } from './round/columns';
import { useTheme } from '../theme/ThemeContext'; 
import type { RoundRow } from './round/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const RoundPage: React.FC = () => {
  const { colors, effects } = useTheme();
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
      alert('Đã lưu thành công');
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildRoundColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-2">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: '42px', height: '42px', backgroundColor: colors.primaryGlow }}
          >
            <Map size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h3 fw-bold text-white m-0">Quản lý Chặng đi</h1>
        </div>
        
        <button 
          className="btn-refresh-custom" 
          onClick={() => { setDeletedIds([]); refetch(); }}
          style={{ backgroundColor: colors.surfaceLight, border: `1px solid ${colors.borderLight}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      <div 
        className="p-3 mb-4 d-flex justify-content-end align-items-center gap-2"
        style={{ 
          background: 'rgba(30, 41, 59, 0.4)', 
          backdropFilter: 'blur(8px)', 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}` 
        }}
      >
        <button 
          className="btn-custom-action btn-outline-primary-custom" 
          onClick={handleAddRow}
          style={{ borderColor: colors.primary, color: colors.primary }}
        >
          <Plus size={18} /> 
          <span className="d-none d-sm-inline">Thêm dòng</span>
        </button>

        <button
          className="btn-custom-action"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          style={{ 
            backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight, 
            color: '#fff', 
            boxShadow: dirtyCount > 0 ? `0 0 15px ${colors.success}44` : 'none',
            opacity: isSaving ? 0.7 : 1,
            cursor: dirtyCount > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          <Save size={18} />
          <span className="d-none d-sm-inline">
            {isSaving ? 'Đang lưu...' : `Lưu thay đổi (${dirtyCount})`}
          </span>
          <span className="d-inline d-sm-none">{dirtyCount}</span>
        </button>
      </div>

      <DataTable
        title="Danh sách các chặng"
        columns={columns}
        queryKey={['rounds-local', tripId]}
        data={rows}
        isLoading={isLoading}
        isError={isError}
      />

      <style>{`
        .btn-custom-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 20px;
          height: 42px;
          font-weight: 700;
          border-radius: 10px;
          border: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-custom-action:active { transform: scale(0.95); }

        .btn-outline-primary-custom {
          background: transparent;
          border: 1px solid currentColor !important;
        }
        .btn-outline-primary-custom:hover {
          background: ${colors.primary}11;
          box-shadow: 0 0 12px ${colors.primary}33;
        }

        .btn-custom-action:not(:disabled):hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .btn-refresh-custom {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: all 0.2s;
          border: none;
        }
        .btn-refresh-custom:hover { background-color: ${colors.border} !important; color: #fff !important; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default RoundPage;