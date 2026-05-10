import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Users, Filter, Bus, RefreshCw } from 'lucide-react';
import DataTable from '../components/DataTable';
import { PassengerExcelImport } from '../components/passenger-import';
import api from '../services/api';
import { normalizePhoneNumber } from '../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import { useTheme } from '../theme/ThemeContext';
import type {
  BusesByTrip,
  PassengerBus,
  PassengerRow,
  PassengerTrip
} from './passenger/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 1;

const PassengerPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importResetToken, setImportResetToken] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, PassengerRow>>({});

  // --- DATA FETCHING (Giữ nguyên logic của bạn) ---
  const { data: trips = [] } = useQuery<PassengerTrip[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const { data: allBuses = [] } = useQuery<PassengerBus[]>({
    queryKey: ['buses-all-trips', trips.map((t: any) => t.id).join(',')],
    enabled: trips.length > 0,
    queryFn: async () => {
      const busesPerTrip = await Promise.all(trips.map((trip) => api.getBuses(String(trip.id))));
      return busesPerTrip.flat();
    },
  });

  const { data: passengers = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId, selectedBusId],
    enabled: trips.length > 0,
    queryFn: async () => {
      if (selectedTripId) return api.getPassengers(String(selectedTripId), selectedBusId ? String(selectedBusId) : undefined);
      const passengersPerTrip = await Promise.all(trips.map((trip) => api.getPassengers(String(trip.id))));
      return passengersPerTrip.flat();
    },
  });

  // --- LOGIC XỬ LÝ DỮ LIỆU ---
  useEffect(() => {
    if (!selectedTripId) { setSelectedBusId(null); return; }
    const busesOfSelectedTrip = allBuses.filter((bus: any) => Number(bus.trip?.id ?? selectedTripId) === selectedTripId);
    if (!busesOfSelectedTrip.length) { setSelectedBusId(null); return; }
    if (selectedBusId !== null) {
      const exists = busesOfSelectedTrip.some((bus) => Number(bus.id) === selectedBusId);
      if (!exists) setSelectedBusId(null);
    }
  }, [allBuses, selectedTripId, selectedBusId]);

  useEffect(() => {
    setRows([]);
    setDeletedIds([]);
  }, [selectedTripId, selectedBusId]);

  useEffect(() => {
    if (!passengers) return;
    const mapped: PassengerRow[] = passengers.map((p: any) => ({
      id: p.id,
      localId: `db_${p.id}`,
      name: p.name || '',
      tel: p.tel || '',
      note: p.note || '',
      tripId: p.bus?.trip?.id ? Number(p.bus.trip.id) : selectedTripId,
      busId: p.bus?.id ? Number(p.bus.id) : null,
      busCode: p.bus?.busCode || p.bus?.registrationNumber || '',
    }));
    const initialById: Record<number, PassengerRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;
    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({ localId: makeLocalId(), name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' });
    }
    setRows(padded);
  }, [passengers, selectedBusId, selectedTripId]);

  const busesByTrip = useMemo<BusesByTrip>(() => {
    const map: BusesByTrip = {};
    allBuses.forEach((bus: any) => {
      const tId = Number(bus.trip?.id ?? selectedTripId ?? 0);
      if (!map[tId]) map[tId] = [];
      map[tId].push(bus);
    });
    return map;
  }, [allBuses, selectedTripId]);

  const busOptions = useMemo(() => (!selectedTripId ? [] : busesByTrip[selectedTripId] || []), [busesByTrip, selectedTripId]);
  const isAllTripsView = selectedTripId === null && selectedBusId === null;
  const isTargetSelectionReady = Boolean(selectedTripId && selectedBusId);

  const isSameRow = (current: PassengerRow, initial: PassengerRow) => {
    const currentNote = (current.note || '').trim();
    const initialNote = (initial.note || '').trim();
    return (
      current.name.trim() === initial.name.trim() &&
      current.tel.trim() === initial.tel.trim() &&
      currentNote === initialNote &&
      (current.busId ?? null) === (initial.busId ?? null)
    );
  };

  const isNewRowDirty = (row: PassengerRow) => {
    const note = (row.note || '').trim();
    return Boolean(row.name.trim() || row.tel.trim() || note || row.busId);
  };

  const isRowDirty = (row: PassengerRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && isNewRowDirty(row)).length;
    const edited = rows.filter((row) => row.id && isRowDirty(row)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    setRows((prev) => prev.map((row) => {
      if (row.localId !== localId) return row;
      const nextRow = { ...row, [key]: value };
      if (!row.id) return nextRow;
      const initial = initialRowsByIdRef.current[row.id];
      const isEdited = initial ? !isSameRow(nextRow, initial) : true;
      return { ...nextRow, isEdited };
    }));
  };

  const handleAddRow = () => {
    if (isAllTripsView) return;
    setRows((prev) => [...prev, { localId: makeLocalId(), name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' }]);
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (isAllTripsView) return;
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const handleSave = async () => {
    if (isAllTripsView) return;
    if (!selectedTripId || !selectedBusId) {
      enqueueSnackbar('Vui lòng chọn cả chuyến đi và xe trước khi lưu', { variant: 'warning' });
      return;
    }

    const rowsMissingBus = rows.filter(
      (row) => !row.id && isNewRowDirty(row) && !row.busId
    );

    if (rowsMissingBus.length > 0) {
      enqueueSnackbar(`Có ${rowsMissingBus.length} dòng chưa gán xe. Vui lòng kiểm tra lại trước khi lưu`, { variant: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter(r => !r.id && r.name.trim() && r.busId).map(r => api.createPassenger(String(r.tripId), { name: r.name.trim(), note: r.note || null, busId: r.busId, tel: normalizePhoneNumber(r.tel) || null })),
        ...rows.filter(r => r.id && isRowDirty(r)).map(r => api.updatePassenger(String(r.id), { name: r.name.trim(), note: r.note || null, busId: r.busId, tel: normalizePhoneNumber(r.tel) || null })),
        ...deletedIds.map(id => api.deletePassenger(String(id)))
      ]);
      setDeletedIds([]); await refetch(); setImportResetToken(p => p + 1);
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const handleImportedPreview = (payload: {
    rows: Array<{
      localId?: string;
      name: string;
      tel: string;
      note: string;
      tripId: number | null;
      busId: number | null;
      busCode?: string;
    }>;
  }) => {
    setRows((prev) => {
      const keptRows = prev.filter((row) => row.id || isNewRowDirty(row));

      const importedRows: PassengerRow[] = payload.rows.map((row, index) => ({
        localId: row.localId || `excel_${Date.now()}_${index}`,
        name: row.name || '',
        tel: row.tel || '',
        note: row.note || '',
        tripId: row.tripId ?? selectedTripId,
        busId: row.busId ?? selectedBusId ?? null,
        busCode: row.busCode || '',
      }));

      const nextRows = [...keptRows, ...importedRows];

      if (!nextRows.length) {
        nextRows.push({
          localId: makeLocalId(),
          name: '',
          tel: '',
          note: '',
          tripId: selectedTripId,
          busId: selectedBusId,
          busCode: '',
        });
      }

      return nextRows;
    });
  };

  const columns = buildPassengerColumns({
    trips: selectedTripId ? trips.filter(t => t.id === selectedTripId) : trips,
    busesByTrip, readOnly: isAllTripsView, handleCellChange, handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 passenger-page">
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
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Quản lý Hành khách</h1>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => refetch()} 
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Toolbar / Filters - Tinh giản chiều cao và khung */}
      <div 
        className="p-2 mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3 px-3 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.md,
          border: `1px solid ${colors.border}`,
        }}
      >
      <div className="d-flex align-items-center gap-3 flex-wrap w-100">
          {/* Filter Chuyến đi */}
          <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: '200px' }}>
            <Filter size={14} style={{ color: colors.textSecondary }} className="flex-shrink-0" />
            <select
              className="form-select-custom-toolbar w-100"
              value={selectedTripId ?? ''}
              onChange={(e) => setSelectedTripId(e.target.value ? Number(e.target.value) : null)}
              style={{ 
                backgroundColor: isDarkMode ? colors.background : '#fff', 
                color: colors.textPrimary, 
                border: `1px solid ${colors.border}`,
                height: '38px' 
              }}
            >
              <option value="">Tất cả chuyến đi</option>
              {trips.map((trip: any) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </div>

          {/* Filter Xe */}
          <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: '200px' }}>
            <Bus size={14} style={{ color: colors.textSecondary }} className="flex-shrink-0" />
            <select
              className="form-select-custom-toolbar w-100"
              value={selectedBusId ?? ''}
              onChange={(e) => setSelectedBusId(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedTripId}
              style={{ 
                backgroundColor: isDarkMode ? colors.background : '#fff', 
                color: colors.textPrimary, 
                border: `1px solid ${colors.border}`,
                height: '38px'
              }}
            >
              <option value="">Tất cả xe</option>
              {busOptions.map((bus: any) => (
                <option key={bus.id} value={bus.id}>{bus.busCode} - {bus.registrationNumber}</option>
              ))}
            </select>
          </div>
      </div>

        <div className="d-flex align-items-center gap-2">
          {!isAllTripsView ? (
            <>
              <PassengerExcelImport selectedTripId={selectedTripId} resetToken={importResetToken} disabled={isSaving || !isTargetSelectionReady} onImported={handleImportedPreview} />
            </>
          ) : (
             <span className="small px-3 py-1 rounded-pill" style={{ background: isDarkMode ? colors.surfaceLight : '#f1f5f9', color: colors.textSecondary, border: `1px solid ${colors.border}` }}>
                Chế độ xem tổng hợp
             </span>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách hành khách"
          titleActions={
            <button
              className="btn-custom-action-save shadow-sm"
              onClick={handleSave}
              disabled={isSaving || dirtyCount === 0 || !isTargetSelectionReady}
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
          queryKey={['passengers-local', selectedTripId, selectedBusId]}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={refetch}
        />
        {!isAllTripsView && (
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
        )}
      </div>

      <style>{`
        /* Ô nhập liệu trong bảng sắc nét hơn */
        .passenger-page .td-content input, 
        .passenger-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .passenger-page .td-content input:focus, 
        .passenger-page .td-content select:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Select trên Toolbar gọn gàng */
        .form-select-custom-toolbar {
          height: 34px;
          padding: 0 30px 0 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
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
          border-radius: 8px; transition: all 0.2s; cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Làm mờ Header Bảng - Cực nhẹ cho bản Light */
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
        .passenger-page .btn-action-delete {
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

        .passenger-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .passenger-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .passenger-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
        }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default PassengerPage;