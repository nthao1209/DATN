import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable, { type Column } from '../components/DataTable';
import api from '../services/api';

type TripStatus = 'DOING' | 'DONE';

type TripRow = {
  id?: number;
  localId: string;
  name: string;
  status: TripStatus;
  busCount: number;
  roundCount: number;
  isEdited?: boolean;
};

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
      status: (t.status === 'DONE' ? 'DONE' : 'DOING') as TripStatus,
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

  const columns: Column<TripRow>[] = [
    { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
    {
      header: 'Tên chuyến',
      key: 'name',
      render: (row) => (
        <input
          className="form-control form-control-sm"
          value={row.name}
          onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
          placeholder="Nhập tên chuyến"
        />
      ),
    },
    {
      header: 'Trạng thái',
      key: 'status',
      render: (row) => (
        <select
          className="form-select form-select-sm"
          value={row.status}
          onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as TripStatus)}
        >
          <option value="DOING">Đang diễn ra</option>
          <option value="DONE">Hoàn thành</option>
        </select>
      ),
    },
    {
      header: 'Số xe',
      key: 'busCount',
      render: (row) =>
        row.id ? (
          <button className="btn btn-sm btn-link fw-bold text-decoration-none p-0" onClick={() => navigate(`/trips/${row.id}/buses`)}>
            {row.busCount}
          </button>
        ) : (
          '-'
        ),
    },
    {
      header: 'Số round',
      key: 'roundCount',
      render: (row) =>
        row.id ? (
          <button className="btn btn-sm btn-link fw-bold text-decoration-none p-0" onClick={() => navigate(`/trips/${row.id}/rounds`)}>
            {row.roundCount}
          </button>
        ) : (
          '-'
        ),
    },
    {
      header: 'Thao tác',
      key: 'actions',
      render: (row) => (
        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRow(row)}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

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

      {isMobile ? (
        <div className="d-grid gap-3">
          {rows.map((row, index) => (
            <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <div className="small text-muted">Dòng {index + 1}</div>
                    <div className="fw-bold">{row.id ? `Trip #${row.id}` : 'Mới'}</div>
                  </div>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRow(row)}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">Tên chuyến</label>
                  <input
                    className="form-control"
                    value={row.name}
                    onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
                    placeholder="Nhập tên chuyến"
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">Trạng thái</label>
                  <select
                    className="form-select"
                    value={row.status}
                    onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as TripStatus)}
                  >
                    <option value="DOING">Đang diễn ra</option>
                    <option value="DONE">Hoàn thành</option>
                  </select>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="text-center p-2 app-dark-soft rounded">
                      <div className="text-muted small">Số xe</div>
                      <div className="fw-bold text-info">{row.busCount}</div>
                      {row.id && (
                        <button
                          className="btn btn-link btn-sm mt-1"
                          onClick={() => navigate(`/trips/${row.id}/buses`)}
                        >
                          Quản lý
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="text-center p-2 app-dark-soft rounded">
                      <div className="text-muted small">Số round</div>
                      <div className="fw-bold text-info">{row.roundCount}</div>
                      {row.id && (
                        <button
                          className="btn btn-link btn-sm mt-1"
                          onClick={() => navigate(`/trips/${row.id}/rounds`)}
                        >
                          Quản lý
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
      )}

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
