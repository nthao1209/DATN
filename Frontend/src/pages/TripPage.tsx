import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Route, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildTripColumns } from './trip/columns';
import { useTheme } from '../theme/ThemeContext';
import type { TripRow } from './trip/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const TripPage: React.FC = () => {
  const { colors, effects } = useTheme();
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
      padded.push({
        localId: makeLocalId(),
        name: '',
        status: 'DOING',
        busCount: 0,
        roundCount: 0,
      });
    }
    setRows(padded);
  }, [trips]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.name.trim()).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof TripRow>(localId: string, key: K, value: TripRow[K]) => {
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
        status: 'DOING',
        busCount: 0,
        roundCount: 0,
      },
    ]);
  };

  const handleDeleteRow = (row: TripRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim());
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) {
      alert('Không có thay đổi nào để lưu');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((r) => api.createTrip({ name: r.name.trim(), status: r.status })),
        ...rowsToUpdate.map((r) => api.updateTrip(String(r.id), { name: r.name.trim(), status: r.status })),
        ...deletedIds.map((id) => api.deleteTrip(String(id))),
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

  const columns = buildTripColumns({
    handleCellChange,
    handleDeleteRow,
    onManageBuses: (id) => navigate(`/trips/${id}/buses`),
    onManageRounds: (id) => navigate(`/trips/${id}/rounds`),
  });

  return (
    <div className="animate-fade-in p-0 p-md-2">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: '42px', height: '42px', backgroundColor: colors.primaryGlow }}
          >
            <Route size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h3 fw-bold text-white m-0" style={{ letterSpacing: '-0.02em' }}>Quản lý Chuyến đi</h1>
        </div>
        
        <button 
          className="btn-refresh-custom" 
          onClick={() => { setDeletedIds([]); refetch(); }}
          title="Làm mới dữ liệu"
          style={{ backgroundColor: colors.surfaceLight, border: `1px solid ${colors.borderLight}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Action Toolbar - Dồn hết sang phải & Hiệu ứng lún */}
      <div 
        className="p-3 mb-4 d-flex justify-content-end align-items-center gap-2"
        style={{ 
          background: 'rgba(30, 41, 59, 0.4)', 
          backdropFilter: 'blur(10px)', 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
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
        title="Danh sách lộ trình"
        columns={columns}
        queryKey={['trips-local']}
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
          transform: translateY(-1px);
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
          cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.border} !important; color: #fff !important; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .btn-custom-action { padding: 0 15px; }
        }
      `}</style>
    </div>
  );
};

export default TripPage;