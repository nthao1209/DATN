import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildRoundColumns } from './round/columns';
import type { RoundRow } from './round/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const RoundPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


  const { data: rounds = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['rounds', tripId],
    queryFn: () => api.getRounds(String(tripId)),
    enabled: !!tripId,
  });

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

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
    if (!tripId) {
      alert('Khong tim thay tripId');
      return;
    }

    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim() && r.time.trim());
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) {
      alert('Khong co thay doi nao');
      return;
    }

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
    <div className="p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="m-0 fw-bold">Quản lý Chặng đi</h3>
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
          title="Danh sách các chặng"
          columns={columns}
          queryKey={['rounds-local', tripId]}
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

export default RoundPage;
