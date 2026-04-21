import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import BusMobileView from '../components/mobile/BusMobileView';
import api from '../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { buildBusColumns } from './bus/columns';
import type { BusManager, BusRow } from './bus/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const BusPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<BusRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


  const { data: buses = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });

  const { data: managers = [] } = useQuery<BusManager[]>({
    queryKey: ['bus-managers'],
    queryFn: api.getBusManagers,
  });

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

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
    const created = rows.filter(
      (r) =>
        !r.id &&
        r.busCode.trim() &&
        r.registrationNumber.trim() &&
        r.driverName.trim() &&
        r.driverTel.trim() &&
        r.tourGuideName.trim() &&
        r.tourGuideTel.trim() &&
        !!r.managerId
    ).length;

    const edited = rows.filter((r) => r.id && r.isEdited).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const handleCellChange = <K extends keyof BusRow>(localId: string, key: K, value: BusRow[K]) => {
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
        busCode: '',
        registrationNumber: '',
        driverName: '',
        driverTel: '',
        tourGuideName: '',
        tourGuideTel: '',
        description: '',
        managerId: null,
        managerName: '',
      },
    ]);
  };

  const handleDeleteRow = (row: BusRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (!tripId) {
      alert('Khong tim thay tripId');
      return;
    }

    const invalidPhoneRow = rows.find(
      (row) =>
        (
          row.driverTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.driverTel))
        ) ||
        (
          row.tourGuideTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.tourGuideTel))
        )
    );

    if (invalidPhoneRow) {
      alert('Số điện thoại phải đủ 10 số và được bắt đầu bằng 0.');
      return;
    }

    const rowsToCreate = rows.filter(
      (r) =>
        !r.id &&
        r.busCode.trim() &&
        r.registrationNumber.trim() &&
        r.driverName.trim() &&
        r.driverTel.trim() &&
        r.tourGuideName.trim() &&
        r.tourGuideTel.trim() &&
        !!r.managerId
    );

    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) {
      alert('Khong co thay doi nao');
      return;
    }

    try {
      setIsSaving(true);

      await Promise.all([
        ...rowsToCreate.map((r) =>
          api.createBus(tripId, {
            busCode: r.busCode.trim(),
            registrationNumber: r.registrationNumber.trim(),
            driverName: r.driverName.trim(),
            driverTel: normalizePhoneNumber(r.driverTel),
            tourGuideName: r.tourGuideName.trim(),
            tourGuideTel: normalizePhoneNumber(r.tourGuideTel),
            description: r.description.trim() || null,
            managerId: Number(r.managerId),
          })
        ),
        ...rowsToUpdate.map((r) =>
          api.updateBus(String(r.id), {
            busCode: r.busCode.trim(),
            registrationNumber: r.registrationNumber.trim(),
            driverName: r.driverName.trim(),
            driverTel: normalizePhoneNumber(r.driverTel),
            tourGuideName: r.tourGuideName.trim(),
            tourGuideTel: normalizePhoneNumber(r.tourGuideTel),
            description: r.description.trim() || null,
            managerId: r.managerId ? Number(r.managerId) : null,
          })
        ),
        ...deletedIds.map((id) => api.deleteBus(String(id))),
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

  const columns = buildBusColumns({
    managers,
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="p-3 p-md-4 bus-page">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="m-0 fw-bold">Quản lý xe</h3>
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
        <BusMobileView
          rows={rows}
          managers={managers}
          onDeleteRow={handleDeleteRow}
          onCellChange={handleCellChange}
        />
      ) : (
        <DataTable
          title="Danh sách các xe"
          columns={columns}
          queryKey={['buses-local', tripId]}
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

        @media (min-width: 1200px) {
          .bus-page .table > :not(caption) > * > * {
            padding: 1rem 1.25rem;
            font-size: 0.95rem;
          }

          .bus-page .table th {
            white-space: nowrap;
          }

          .bus-page .form-control,
          .bus-page .form-select {
            min-height: 46px;
            padding-top: 0.65rem;
            padding-bottom: 0.65rem;
          }

          .bus-page .btn-sm {
            min-height: 38px;
            padding-top: 0.45rem;
            padding-bottom: 0.45rem;
          }
        }
      `}</style>
    </div>
  );
};

export default BusPage;
