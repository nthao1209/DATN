import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildTripColumns } from './trip/columns';
import type { TripRow } from './trip/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const TripPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


  const { data: trips = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

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
    <div className="p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="m-0 fw-bold">Quản lý Chuyến đi</h3>
        </div>
      </div>

      <div className="d-grid gap-2 d-md-flex align-items-md-end mb-3">
        <button className="btn btn-primary d-flex align-items-center justify-content-center gap-1" onClick={handleAddRow}>
          <Plus size={14} /> Thêm dòng
        </button>
        <button
          className="btn btn-success d-flex align-items-center justify-content-center gap-1"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
        >
          <Save size={14} /> {isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
        </button>
      </div>

      
        <DataTable
          title="Danh sách các chuyến đi"
          columns={columns}
          queryKey={['trips-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => {
            setDeletedIds([]);
            refetch();
          }}
        />
  

      <style>{`
        .card .form-control,
        .card .form-select {
          min-height: 44px;
        }
      `}</style>
    </div>
  );
};

export default TripPage;
