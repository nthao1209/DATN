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
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const BusPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); // Lấy thêm isDarkMode để tinh chỉnh shadow
  const { enqueueSnackbar } = useSnackbar();
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<BusRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- DATA FETCHING (Giữ nguyên) ---
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
      padded.push({ localId: makeLocalId(), busCode: '', registrationNumber: '', driverName: '', driverTel: '', tourGuideName: '', tourGuideTel: '', description: '', managerId: null, managerName: '' });
    }
    setRows(padded);
  }, [buses]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.busCode.trim() && r.registrationNumber.trim()).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

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
    if (invalidPhoneRow) { enqueueSnackbar('Số điện thoại không hợp lệ.', { variant: 'warning' }); return; }
    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter(r => !r.id && r.busCode.trim()).map(r => api.createBus(tripId, { ...r, managerId: Number(r.managerId), driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...rows.filter(r => r.id && r.isEdited).map(r => api.updateBus(String(r.id), { ...r, driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...deletedIds.map(id => api.deleteBus(String(id)))
      ]);
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const columns = buildBusColumns({ managers, handleCellChange, handleDeleteRow});

  return (
    <div className="animate-fade-in p-0 p-md-3 bus-page">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ 
                width: '42px', 
                height: '42px', 
                backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
                border: `1px solid ${colors.primary}33`
            }}
          >
            <Bus size={20} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Quản lý Đội xe</h1>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => { setDeletedIds([]); refetch(); }}
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>


      {/* Bọc Table trong một Card có shadow nhẹ */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Thông tin chi tiết đội xe"
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
          queryKey={['buses-local', tripId]}
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
        .bus-page .td-content input, 
        .bus-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${colors.border} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .bus-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
        }

        /* Nút Action Gọn hơn */
        .btn-custom-action-small, .btn-custom-action-save {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          transition: all 0.2s;
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
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Sửa Header Bảng cho Light Mode */
        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#475569'} !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.025em !important;
          padding: 12px !important;
          border-bottom: 1px solid ${colors.border} !important;
        }
        .bus-page .btn-action-delete {
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

        .bus-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .bus-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .bus-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default BusPage;