import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import DataTable from '../components/DataTable';
import PassengerMobileView from '../components/mobile/PassengerMobileView';
import api from '../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import type { BusesByTrip, PassengerBus, PassengerRow, PassengerTrip } from './passenger/types';


const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 8;

const PassengerPage: React.FC = () => {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


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

  const {
    data: passengers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId, selectedBusId],
    queryFn: () => api.getPassengers(String(selectedTripId), selectedBusId ? String(selectedBusId) : undefined),
    enabled: !!selectedTripId,
  });

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(Number(trips[0].id));
    }
  }, [trips, selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) {
      setSelectedBusId(null);
      return;
    }

    const busesOfSelectedTrip = allBuses.filter(
      (bus: any) => Number(bus.trip?.id ?? selectedTripId) === selectedTripId
    );

    if (!busesOfSelectedTrip.length) {
      setSelectedBusId(null);
      return;
    }

    if (selectedBusId === null) {
      return;
    }

    const exists = busesOfSelectedTrip.some((bus) => Number(bus.id) === selectedBusId);
    if (!exists) {
      setSelectedBusId(null);
    }
  }, [allBuses, selectedTripId, selectedBusId]);

  useEffect(() => {
    setRows([]);
    setDeletedIds([]);
  }, [selectedTripId, selectedBusId]);

  useEffect(() => {
    if (!passengers) return;

    const mapped: PassengerRow[] = passengers.map((passenger: any) => ({
      id: passenger.id,
      localId: `db_${passenger.id}`,
      name: passenger.name || '',
      tel: passenger.tel || '',
      note: passenger.note || '',
      tripId: passenger.bus?.trip?.id ? Number(passenger.bus.trip.id) : selectedTripId,
      busId: passenger.bus?.id ? Number(passenger.bus.id) : null,
      busCode: passenger.bus?.busCode || '',
    }));

    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        tel: '',
        note: '',
        tripId: selectedTripId,
        busId: selectedBusId,
        busCode: '',
      });
    }

    setRows(padded);
  }, [passengers, selectedBusId]);

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

  const visibleRows = useMemo(() => {
    if (!selectedBusId) return rows;
    return rows.filter((row) => row.busId === selectedBusId);
  }, [rows, selectedBusId]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && row.name.trim() && row.busId).length;
    const edited = rows.filter((row) => row.id && row.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? {
              ...row,
              [key]: value,
              ...(row.id ? { isEdited: true } : {}),
            }
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
        tel: '',
        note: '',
        tripId: selectedTripId,
        busId: selectedBusId,
        busCode: '',
      },
    ]);
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (row.id) {
      setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    }
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToCreate = rows.filter(
      (row) => !row.id && row.name.trim() && row.busId && row.tripId
    );
    const rowsToUpdate = rows.filter((row) => row.id && row.isEdited);

    const invalidPhoneRow = rows.find((row) => row.name.trim() && row.tel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.tel)));
    if (invalidPhoneRow) {
      alert('Số điện thoại phải đủ 10 số và  bắt đầu bằng 0.');
      return;
    }

    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) {
      alert('Khong co thay doi nao');
      return;
    }

    try {
      setIsSaving(true);

      await Promise.all([
        ...rowsToCreate.map((row) =>
          api.createPassenger(String(row.tripId), {
            name: row.name.trim(),
            note: row.note || null,
            busId: row.busId,
            tel: normalizePhoneNumber(row.tel) || null,
          })
        ),
        ...rowsToUpdate.map((row) =>
          api.updatePassenger(String(row.id), {
            name: row.name.trim(),
            note: row.note || null,
            busId: row.busId,
            tel: normalizePhoneNumber(row.tel) || null,
          })
        ),
        ...deletedIds.map((id) => api.deletePassenger(String(id))),
      ]);

      setDeletedIds([]);
      await refetch();
      alert('Đã lưu thành công');
    } catch (error: any) {
      alert(error?.message || 'Lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };
  const columns = buildPassengerColumns({
    trips,
    busesByTrip,
    handleCellChange,
    handleDeleteRow,
  });

  const mobileRows = visibleRows.length > 0 ? visibleRows : rows;

  return (
    <div className="p-3 p-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">Quản lý Hành khách</h1>
      </div>
      <div className="d-grid gap-2 d-md-flex align-items-md-end mb-3 passenger-toolbar">
        <div className="flex-grow-1">
          <label className="form-label small fw-bold mb-1">Chuyến đi</label>
          <select
            className="form-select"
            value={selectedTripId ?? ''}
            onChange={(e) => setSelectedTripId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Chọn chuyến đi</option>
            {trips.map((trip: any) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-grow-1">
          <label className="form-label small fw-bold mb-1">Lọc theo xe</label>
          <select
            className="form-select"
            value={selectedBusId ?? ''}
            onChange={(e) => setSelectedBusId(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedTripId}
          >
            <option value="">Tất cả xe</option>
            {busOptions.map((bus: any) => (
              <option key={bus.id} value={bus.id}>
                {bus.busCode} - {bus.registrationNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="d-grid gap-2 d-md-flex align-items-md-end passenger-actions">
          <button className="btn btn-primary d-flex align-items-center justify-content-center gap-1" onClick={handleAddRow}>
            <Plus size={14} />
            Thêm dòng
          </button>
          <button
            className="btn btn-success d-flex align-items-center justify-content-center gap-1"
            onClick={handleSave}
            disabled={isSaving || dirtyCount === 0 || !selectedTripId}
          >
            <Save size={14} />
            {isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
          </button>
        </div>
      </div>

      {isMobile ? (
        <PassengerMobileView
          rows={mobileRows}
          trips={trips}
          busesByTrip={busesByTrip}
          onDeleteRow={handleDeleteRow}
          onCellChange={handleCellChange}
        />
      ) : (
        <DataTable
          title="Danh sách hành khách"
          columns={columns}
          queryKey={['passengers-local', selectedTripId, selectedBusId]}
          data={visibleRows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={refetch}
        />
      )}

      <style>{`
        .passenger-toolbar .form-select,
        .passenger-toolbar .btn {
          min-height: 44px;
        }

        @media (max-width: 767.98px) {
          .passenger-mobile-card .form-control,
          .passenger-mobile-card .form-select {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
};

export default PassengerPage;
