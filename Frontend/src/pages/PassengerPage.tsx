import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import api from '../services/api';

type PassengerRow = {
  id?: number;
  localId: string;
  name: string;
  tripId: number | null;
  busId: number | null;
  busCode?: string;
  note: string;
  isEdited?: boolean;
};

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 8;

const PassengerPage: React.FC = () => {

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);

  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 🔥 dùng để kiểm soát sync 1 lần
  const initializedRef = useRef(false);

  // ==================== SERVER STATE ====================

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const { data: buses = [] } = useQuery<any[]>({
    queryKey: ['buses', selectedTripId],
    queryFn: () => api.getBuses(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const {
    data: passengers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId],
    queryFn: () => api.getPassengers(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  // ==================== INIT DEFAULT ====================

  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(Number(trips[0].id));
    }
  }, [trips]);

  useEffect(() => {
    if (!buses.length) {
      if (selectedBusId !== null) setSelectedBusId(null);
      return;
    }

    if (selectedBusId === null) {
      return;
    }

    const exists = buses.some((b: any) => Number(b.id) === selectedBusId);
    if (!exists) {
      setSelectedBusId(null);
    }
  }, [buses]);

  // ==================== RESET WHEN TRIP CHANGE ====================

  useEffect(() => {
    initializedRef.current = false;
    setRows([]);
    setDeletedIds([]);
  }, [selectedTripId]);

  // ==================== SYNC 1 LẦN ====================

  useEffect(() => {
    if (!passengers || initializedRef.current) return;

    const mapped: PassengerRow[] = passengers.map((p: any) => ({
      id: p.id,
      localId: `db_${p.id}`,
      name: p.name || '',
      tripId: Number(p.bus?.trip?.id ?? selectedTripId),
      busId: Number(p.bus?.id ?? null),
      busCode: p.bus?.busCode || '',
      note: p.note || '',
    }));

    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        tripId: selectedTripId,
        busId: selectedBusId,
        note: '',
      });
    }

    setRows(padded);
    initializedRef.current = true;
  }, [passengers]);

  const visibleRows = useMemo(() => {
    if (!selectedBusId) return rows;
    return rows.filter((row) => row.busId === selectedBusId);
  }, [rows, selectedBusId]);

  // ==================== DERIVED ====================

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && r.name.trim() && r.busId).length;
    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  // ==================== HANDLERS ====================

  const handleCellChange = (localId: string, key: any, value: any) => {
    setRows(prev =>
      prev.map(row =>
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
    setRows(prev => [
      ...prev,
      {
        localId: makeLocalId(),
        name: '',
        tripId: selectedTripId,
        busId: selectedBusId,
        note: '',
      },
    ]);
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (row.id) {
      setDeletedIds(prev => [...new Set([...prev, row.id!])]);
    }
    setRows(prev => prev.filter(r => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToCreate = rows.filter(r => !r.id && r.name.trim() && r.busId && r.tripId === selectedTripId);
    const rowsToUpdate = rows.filter(r => r.id && r.isEdited);

    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) {
      alert('Khong co thay doi nao');
      return;
    }

    try {
      setIsSaving(true);

      await Promise.all([
        ...rowsToCreate.map(r =>
          api.createPassenger(String(r.tripId), {
            name: r.name.trim(),
            note: r.note || null,
            busId: r.busId,
          })
        ),
        ...rowsToUpdate.map(r =>
          api.updatePassenger(String(r.id), {
            name: r.name.trim(),
            note: r.note || null,
            busId: r.busId,
          })
        ),
        ...deletedIds.map(id => api.deletePassenger(String(id))),
      ]);

      initializedRef.current = false;
      await refetch();

      alert('Da luu thanh cong');
    } catch (err: any) {
      alert(err?.message || 'Loi khi luu');
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== COLUMNS ====================

  const columns: Column<PassengerRow>[] = [
    {
      header: 'STT',
      key: 'stt',
      render: (_row, idx) => idx + 1,
    },
    {
      header: 'Ten',
      key: 'name',
      render: row => (
        <input
          className="form-control form-control-sm"
          value={row.name}
          onChange={e => handleCellChange(row.localId, 'name', e.target.value)}
        />
      ),
    },
    {
      header: 'Xe',
      key: 'busId',
      render: row => (
        <select
          className="form-select form-select-sm"
          value={row.busId ?? ''}
          onChange={(e) => {
            const nextBusId = e.target.value ? Number(e.target.value) : null;
            const selectedBus = buses.find((b: any) => Number(b.id) === nextBusId);
            handleCellChange(row.localId, 'busId', nextBusId);
            handleCellChange(row.localId, 'busCode', selectedBus?.busCode || '');
          }}
        >
          <option value="">-- Chon xe --</option>
          {buses.map((b: any) => (
            <option key={b.id} value={b.id}>{b.busCode}</option>
          ))}
        </select>
      ),
    },
    {
      header: 'Ghi chu',
      key: 'note',
      render: row => (
        <input
          className="form-control form-control-sm"
          value={row.note}
          onChange={e => handleCellChange(row.localId, 'note', e.target.value)}
        />
      ),
    },
    {
      header: 'Xoa',
      key: 'actions',
      render: row => (
        <button onClick={() => handleDeleteRow(row)}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  // ==================== UI ====================

  return (
    <div className="p-4">
      <div className="mb-3 d-flex gap-2">
        <select
          value={selectedTripId ?? ''}
          onChange={e => setSelectedTripId(Number(e.target.value))}
        >
          {trips.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={selectedBusId ?? ''}
          onChange={e => setSelectedBusId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Tat ca xe</option>
          {buses.map((b: any) => (
            <option key={b.id} value={b.id}>{b.busCode}</option>
          ))}
        </select>

        <button onClick={handleAddRow}>
          <Plus size={14} /> Add
        </button>

        <button onClick={handleSave} disabled={isSaving}>
          <Save size={14} /> Save ({dirtyCount})
        </button>
      </div>

      <DataTable
        title="Passengers"
        columns={columns}
        queryKey={['passengers-local', selectedTripId, selectedBusId]}
        data={visibleRows}
        isLoading={isLoading}
        isError={isError}
        onRefresh={refetch}
      />
    </div>
  );
};

export default PassengerPage;