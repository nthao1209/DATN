import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Bus, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { buildBusColumns } from './bus/columns';
import { useTheme } from '../theme/ThemeContext';
import type { BusManager, BusRow } from './bus/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const BusPage: React.FC = () => {
  const { colors, effects } = useTheme();
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<BusRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- DATA FETCHING ---
  const { data: buses = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });

  const { data: managers = [] } = useQuery<BusManager[]>({
    queryKey: ['bus-managers'],
    queryFn: api.getBusManagers,
  });

  useEffect(() => {
    const mapped: BusRow[] = buses.map((b: any) => ({
      id: Number(b.id),
      localId: `db_${b.id}`,
      busCode: b.busCode || '',
      registrationNumber: b.registrationNumber || '',
      driverName: b.driverName || '',
      driverTel: b.driverTel || '',
      tourGuideName: b.tourGuideName || '',
      tourGuideTel: b.tourGuideTel || '',
      description: b.description || '',
      managerId: b.managerId ? Number(b.managerId) : null,
      managerName: b.manager?.name || '',
    }));

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        busCode: '',
        registrationNumber: '',
        driverName: '',
        driverTel: '',
        tourGuideName: '',
        tourGuideTel: '',
        description: '',
        managerId: null,
        managerName: '',
      });
    }
    setRows(padded);
  }, [buses]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.busCode.trim() && r.registrationNumber.trim()).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof BusRow>(localId: string, key: K, value: BusRow[K]) => {
    setRows((prev) => prev.map((row) => row.localId === localId ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) } : row));
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { localId: makeLocalId(), busCode: '', registrationNumber: '', driverName: '', driverTel: '', tourGuideName: '', tourGuideTel: '', description: '', managerId: null, managerName: '' }]);
  };

  const handleDeleteRow = (row: BusRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (!tripId) return;

    const invalidPhoneRow = rows.find(
      (row) => (row.driverTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.driverTel))) ||
               (row.tourGuideTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.tourGuideTel)))
    );

    if (invalidPhoneRow) {
      alert('Số điện thoại không hợp lệ (phải đủ 10 số và bắt đầu bằng số 0).');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter(r => !r.id && r.busCode.trim()).map(r => api.createBus(tripId, { ...r, managerId: Number(r.managerId), driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...rows.filter(r => r.id && r.isEdited).map(r => api.updateBus(String(r.id), { ...r, driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...deletedIds.map(id => api.deleteBus(String(id)))
      ]);
      setDeletedIds([]);
      await refetch();
      alert('Đã lưu thành công');
    } catch (err: any) {
      alert('Lỗi khi lưu dữ liệu');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildBusColumns({ managers, handleCellChange, handleDeleteRow });

  return (
    <div className="animate-fade-in p-0 p-md-2 bus-page">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: '42px', height: '42px', backgroundColor: colors.primaryGlow }}
          >
            <Bus size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h3 fw-bold text-white m-0" style={{ letterSpacing: '-0.02em' }}>Quản lý Đội xe</h1>
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

      {/* Action Toolbar - Dồn phải & Hiệu ứng bấm */}
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

      {/* Data Table */}
      <DataTable
        title="Thông tin chi tiết đội xe"
        columns={columns}
        queryKey={['buses-local', tripId]}
        data={rows}
        isLoading={isLoading}
        isError={isError}
      />

      <style>{`
        /* Global class cho trang Bus */
        .bus-page .td-content input, 
        .bus-page .td-content select {
          min-height: 40px !important;
        }

        /* Logic Nút Action */
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

        .btn-custom-action:active { 
          transform: scale(0.95); 
        }

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

        /* Nút Refresh */
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
        
        .btn-refresh-custom:hover {
          background-color: ${colors.border} !important;
          color: #fff !important;
          transform: rotate(30deg);
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .bus-page h1 { font-size: 1.15rem; }
          .btn-custom-action { padding: 0 15px; }
        }
      `}</style>
    </div>
  );
};

export default BusPage;