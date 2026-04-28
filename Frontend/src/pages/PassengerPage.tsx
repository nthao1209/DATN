import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Users, Filter, Bus, RefreshCw } from 'lucide-react';
import DataTable from '../components/DataTable';
import { PassengerExcelImport } from '../components/passenger-import';
import api from '../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import { useTheme } from '../theme/ThemeContext';
import type {
  BusesByTrip,
  PassengerBus,
  PassengerImportPreviewResponse,
  PassengerRow,
  PassengerTrip
} from './passenger/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 8;
const isDraftRowEmpty = (row: PassengerRow) => !row.id && !row.name.trim() && !row.tel.trim() && !row.note.trim() && !row.busId;
const normalizeGroupKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const PassengerPage: React.FC = () => {
  const { colors, effects } = useTheme();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importResetToken, setImportResetToken] = useState(0);

  // --- DATA FETCHING ---
  const { data: trips = [] } = useQuery<PassengerTrip[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const { data: allBuses = [] } = useQuery<PassengerBus[]>({
    queryKey: ['buses-all-trips', trips.map((t: any) => t.id).join(',')],
    enabled: trips.length > 0,
    queryFn: async () => {
      const busesPerTrip = await Promise.all(
        trips.map((trip) => api.getBuses(String(trip.id)))
      );
      return busesPerTrip.flat();
    },
  });

  const busTripIdMap = useMemo(() => {
    const map = new Map<number, number>();
    allBuses.forEach((bus: any) => {
      const busId = Number(bus.id);
      const tripId = Number(bus.trip?.id ?? 0);
      if (busId && tripId) {
        map.set(busId, tripId);
      }
    });
    return map;
  }, [allBuses]);

  const {
    data: passengers = [],
    isLoading,
    isError,
    refetch,
    isFetching
  } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId, selectedBusId],
    enabled: trips.length > 0,
    queryFn: async () => {
      if (selectedTripId) {
        return api.getPassengers(String(selectedTripId), selectedBusId ? String(selectedBusId) : undefined);
      }
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
      tripId: p.bus?.trip?.id
        ? Number(p.bus.trip.id)
        : p.bus?.id
          ? busTripIdMap.get(Number(p.bus.id)) ?? selectedTripId
          : selectedTripId,
      busId: p.bus?.id ? Number(p.bus.id) : null,
      busCode: p.bus?.busCode || '',
    }));
    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({ localId: makeLocalId(), name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' });
    }
    setRows(padded);
  }, [busTripIdMap, passengers, selectedBusId, selectedTripId]);

  const busesByTrip = useMemo<BusesByTrip>(() => {
    const map: BusesByTrip = {};
    allBuses.forEach((bus: any) => {
      const tripId = Number(bus.trip?.id ?? selectedTripId ?? 0);
      if (!map[tripId]) map[tripId] = [];
      map[tripId].push(bus);
    });
    return map;
  }, [allBuses, selectedTripId]);

  const busOptions = useMemo(() => {
    if (!selectedTripId) return [];
    return busesByTrip[selectedTripId] || [];
  }, [busesByTrip, selectedTripId]);

  const isAllTripsAllBusesView = selectedTripId === null && selectedBusId === null;

  const visibleRows = useMemo(() => {
    if (!selectedBusId) return rows;
    return rows.filter((row) => row.busId === selectedBusId);
  }, [rows, selectedBusId]);

  const displayRows = useMemo<PassengerRow[]>(() => {
    if (!isAllTripsAllBusesView) {
      return visibleRows;
    }

    const grouped = new Map<string, PassengerRow>();

    rows
      .filter((row) => !isDraftRowEmpty(row))
      .forEach((row) => {
        const nameKey = normalizeGroupKey(row.name);
        const telKey = normalizeGroupKey(row.tel);
        const groupKey = `${nameKey}|${telKey}`;
        const tripId = row.tripId ?? (row.busId ? busTripIdMap.get(row.busId) ?? null : null);

        const current = grouped.get(groupKey);
        const currentAssignments = current?.tripAssignments ?? {};
        const nextAssignments = { ...currentAssignments };

        if (tripId) {
          const existingAssignment = nextAssignments[tripId];
          nextAssignments[tripId] = {
            tripId,
            busId: row.busId ?? existingAssignment?.busId ?? null,
            busCode: row.busCode || existingAssignment?.busCode || '',
            tripName: existingAssignment?.tripName,
          };
        }

        if (!current) {
          grouped.set(groupKey, {
            ...row,
            localId: `group_${groupKey}`,
            tripAssignments: nextAssignments,
          });
          return;
        }

        grouped.set(groupKey, {
          ...current,
          note: current.note || row.note,
          tripAssignments: nextAssignments,
        });
      });

    return Array.from(grouped.values());
  }, [busTripIdMap, isAllTripsAllBusesView, rows, visibleRows]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && row.name.trim() && row.busId).length;
    const edited = rows.filter((row) => row.id && row.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    setRows((prev) => prev.map((row) => row.localId === localId ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) } : row));
  };

  const handleAddRow = () => {
    if (isAllTripsAllBusesView) return;
    setRows((prev) => [...prev, { localId: makeLocalId(), name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' }]);
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (isAllTripsAllBusesView) return;
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const handleImportRows = (payload: PassengerImportPreviewResponse) => {
    if (!selectedTripId) return;
    if (!payload.rows.length) {
      alert("File Excel không có dữ liệu hợp lệ.");
      return;
    }
    setRows((prev) => {
      const retainedRows = prev.filter((row) => !isDraftRowEmpty(row));
      const importedRows: PassengerRow[] = payload.rows.map((row) => ({
        localId: makeLocalId(),
        name: row.name || '',
        tel: row.tel || '',
        note: row.note || '',
        tripId: selectedTripId,
        busId: row.busId ?? null,
        busCode: row.busCode || '',
      }));
      return [...retainedRows, ...importedRows];
    });
  };

  const handleSave = async () => {
    if (isAllTripsAllBusesView) return;
    const rowsToCreate = rows.filter((row) => !row.id && row.name.trim() && row.busId && row.tripId);
    const rowsToUpdate = rows.filter((row) => row.id && row.isEdited);
    
    const invalidPhoneRow = rows.find((row) => row.name.trim() && row.tel.trim() && !isValidPhoneNumber(row.tel));
    if (invalidPhoneRow) {
      alert(`Số điện thoại không hợp lệ: ${invalidPhoneRow.tel}`);
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((row) => api.createPassenger(String(row.tripId), { name: row.name.trim(), note: row.note || null, busId: row.busId, tel: normalizePhoneNumber(row.tel) || null })),
        ...rowsToUpdate.map((row) => api.updatePassenger(String(row.id), { name: row.name.trim(), note: row.note || null, busId: row.busId, tel: normalizePhoneNumber(row.tel) || null })),
        ...deletedIds.map((id) => api.deletePassenger(String(id))),
      ]);
      setDeletedIds([]);
      await refetch();
      setImportResetToken((prev) => prev + 1);
      alert('Đã lưu thành công');
    } catch (error: any) {
      alert(error?.message || 'Lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildPassengerColumns({
    trips: selectedTripId ? trips.filter(t => t.id === selectedTripId) : trips,
    busesByTrip,
    readOnly: isAllTripsAllBusesView,
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-2" style={{ color: colors.textPrimary }}>
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: '42px', height: '42px', backgroundColor: colors.primaryGlow }}
          >
            <Users size={20} style={{ color: colors.primary }} />
          </div>
          <h1 className="h3 fw-bold m-0">Quản lý Hành khách</h1>
        </div>
        <button 
          className="btn-action-custom" 
          onClick={() => refetch()} 
          title="Làm mới"
          style={{ 
            backgroundColor: colors.surfaceLight, 
            border: `1px solid ${colors.borderLight}`,
            color: colors.textSecondary 
          }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Toolbar / Filters */}
      <div 
        className="p-3 mb-4 shadow-sm" 
        style={{ 
          background: colors.surfaceLight,
          backdropFilter: 'blur(8px)', 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}` 
        }}
      >
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="small fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: colors.textSecondary }}>
              <Filter size={14} /> Chuyến đi
            </label>
            <select
              className="form-select select-dark-custom"
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
              value={selectedTripId ?? ''}
              onChange={(e) => setSelectedTripId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Tất cả chuyến đi</option>
              {trips.map((trip: any) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="small fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: colors.textSecondary }}>
              <Bus size={14} /> Lọc theo xe
            </label>
            <select
              className="form-select select-dark-custom"
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
              value={selectedBusId ?? ''}
              onChange={(e) => setSelectedBusId(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedTripId}
            >
              <option value="">Tất cả xe</option>
              {busOptions.map((bus: any) => (
                <option key={bus.id} value={bus.id}>{bus.busCode} - {bus.registrationNumber}</option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 text-md-end">
            <div className="d-flex flex-wrap gap-2 justify-content-md-end">
              {!isAllTripsAllBusesView ? (
                <>
                  <PassengerExcelImport selectedTripId={selectedTripId} resetToken={importResetToken} disabled={isSaving || !selectedTripId} onImported={handleImportRows} />
                  <button 
                    className="btn d-flex align-items-center gap-2 px-3 fw-bold" 
                    onClick={handleAddRow}
                    style={{ border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: '10px' }}
                  >
                    <Plus size={18} /> Thêm dòng
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2 px-4 fw-bold"
                    onClick={handleSave}
                    disabled={isSaving || dirtyCount === 0}
                    style={{ 
                      backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight, 
                      color: colors.textPrimary,
                      borderRadius: '10px',
                      opacity: isSaving ? 0.7 : 1,
                      boxShadow: dirtyCount > 0 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                  >
                    <Save size={18} />
                    {isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
                  </button>
                </>
              ) : (
                <div className="small text-muted align-self-center">Chế độ xem tổng hợp, chỉ hiển thị dữ liệu.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Danh sách hành khách"
        columns={columns}
        queryKey={['passengers-local', selectedTripId, selectedBusId]}
        data={displayRows}
        isLoading={isLoading}
        isError={isError}
        onRefresh={refetch}
      />

      <style>{`
        .select-dark-custom { border-radius: 10px; height: 42px; outline: none; }
        .select-dark-custom:focus { border-color: ${colors.primary} !important; box-shadow: 0 0 0 3px ${colors.primaryGlow}; }
        .btn-action-custom { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 10px; transition: 0.2s; border: none; }
        .btn-action-custom:hover { background-color: ${colors.border} !important; color: ${colors.textPrimary} !important; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default PassengerPage;