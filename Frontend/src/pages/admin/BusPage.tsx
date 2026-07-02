import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../../utils/phone';
import { buildBusColumns } from './bus/columns';
import './BusPage.css';
import type { TransactionRecord } from '../bus-management/transaction/types';
import type { BusManager, BusRow } from './bus/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;
const EMPTY_BUSES: any[] = [];
const EMPTY_MANAGERS: BusManager[] = [];
const EMPTY_TRANSACTIONS: TransactionRecord[] = [];

const BusPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const { id: tripId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<BusRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, BusRow>>({});

  // --- DATA FETCHING (Giữ nguyên) ---
  const { data: busesData, isLoading, isError, refetch} = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });

  const buses = busesData ?? EMPTY_BUSES;

  const { data: managersData } = useQuery<BusManager[]>({
    queryKey: ['bus-managers'],
    queryFn: api.getBusManagers,
  });

  const managers = managersData ?? EMPTY_MANAGERS;

  const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery<TransactionRecord[]>({
    // Dùng transactions để tính số khách check-in/check-out theo từng xe.
    queryKey: ['transactions', tripId],
    queryFn: api.getTransactions,
    enabled: !!tripId,
  });

  const transactions = transactionsData ?? EMPTY_TRANSACTIONS;

  useEffect(() => {
    // Chuyển dữ liệu bus từ API thành rows có thể edit trực tiếp trong bảng.
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
    const initialById: Record<number, BusRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;
    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({ localId: makeLocalId(), busCode: '', registrationNumber: '', driverName: '', driverTel: '', tourGuideName: '', tourGuideTel: '', description: '', managerId: null, managerName: '' });
    }
    setRows(padded);
  }, [buses]);

  const isSameRow = (current: BusRow, initial: BusRow) => {
    // So sánh row hiện tại với snapshot ban đầu để biết có thay đổi cần lưu không.
    return (
      current.busCode.trim() === initial.busCode.trim() &&
      current.registrationNumber.trim() === initial.registrationNumber.trim() &&
      current.driverName.trim() === initial.driverName.trim() &&
      current.driverTel.trim() === initial.driverTel.trim() &&
      current.tourGuideName.trim() === initial.tourGuideName.trim() &&
      current.tourGuideTel.trim() === initial.tourGuideTel.trim() &&
      current.description.trim() === initial.description.trim() &&
      (current.managerId ?? null) === (initial.managerId ?? null)
    );
  };

  const isNewRowDirty = (row: BusRow) => {
    return Boolean(
      row.busCode.trim() ||
      row.registrationNumber.trim() ||
      row.driverName.trim() ||
      row.driverTel.trim() ||
      row.tourGuideName.trim() ||
      row.tourGuideTel.trim() ||
      row.description.trim() ||
      row.managerId
    );
  };

  // Remove any newly added empty rows on unmount and help guard against adding multiple empty rows
  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: BusRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const isRowValid = (row: BusRow) => Boolean(row.busCode.trim());

  const hasValidationErrors = useMemo(
    () => rows.some((row) => isRowDirty(row) && !isRowValid(row)),
    [rows]
  );

  const saveValidationMessage = useMemo(() => {
    if (!hasValidationErrors) return '';
    const missing = new Set<string>();
    rows.forEach((row) => {
      if (!isRowDirty(row)) return;
      if (!row.busCode.trim()) missing.add('Mã xe');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const dirtyCount = useMemo(() => {
    // Tổng số thay đổi gồm row mới, row sửa và row đã đánh dấu xóa.
    const created = rows.filter((r) => !r.id && isNewRowDirty(r)).length;
    const edited = rows.filter((r) => r.id && isRowDirty(r)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;

  const busAttendanceSummary = useMemo(() => {
    // Tính nhanh số check-in/check-out theo xe từ danh sách transaction của chuyến.
    if (!tripId) return [];

    const currentTripId = Number(tripId);
    const tripTransactions = transactions.filter((tx) => {
      const txTripId = Number(tx.round?.tripId ?? (tx as any)?.bus?.tripId ?? 0);
      return txTripId === currentTripId;
    });

    return rows
      .filter((row) => row.id)
      .map((bus) => {
        const busId = Number(bus.id);
        const busTransactions = tripTransactions.filter((tx) => Number(tx.busId ?? tx.bus?.id ?? 0) === busId);

        return {
          busId,
          busLabel: bus.busCode || bus.registrationNumber || `Xe #${bus.id}`,
          checkInCount: busTransactions.filter((tx) => Boolean(tx.checkIn)).length,
          checkOutCount: busTransactions.filter((tx) => Boolean(tx.checkOut)).length,
          totalTransactions: busTransactions.length,
        };
      });
  }, [rows, tripId, transactions]);

  const isPageLoading = isLoading || isTransactionsLoading;

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof BusRow>(localId: string, key: K, value: BusRow[K]) => {
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
    setRows((prev) => {
      const hasEmptyNew = prev.some((r) => !r.id && !isNewRowDirty(r));
      if (hasEmptyNew) {
        const emptyRow = prev.find((r) => !r.id && !isNewRowDirty(r));
        if (emptyRow) {
          setFocusRowKey(emptyRow.localId);
          setFocusRowSignal((value) => value + 1);
        }
        return prev;
      }

      const localId = makeLocalId();
      setFocusRowKey(localId);
      setFocusRowSignal((value) => value + 1);
      return [...prev, { localId, busCode: '', registrationNumber: '', driverName: '', driverTel: '', tourGuideName: '', tourGuideTel: '', description: '', managerId: null, managerName: '' }];
    });
  };

  const handleDeleteRow = (row: BusRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (!tripId) return;
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ thông tin bắt buộc của xe trước khi lưu', { variant: 'warning' });
      return;
    }
    const invalidPhoneRow = rows.find(
      (row) => (row.driverTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.driverTel))) ||
               (row.tourGuideTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.tourGuideTel)))
    );
    if (invalidPhoneRow) { enqueueSnackbar('Số điện thoại không hợp lệ.', { variant: 'warning' }); return; }
    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter(r => !r.id && r.busCode.trim()).map(r => api.createBus(tripId, { ...r, managerId: r.managerId ? Number(r.managerId) : null, registrationNumber: r.registrationNumber.trim() || null, driverTel: normalizePhoneNumber(r.driverTel) || null, tourGuideTel: normalizePhoneNumber(r.tourGuideTel) || null })),
        ...rows.filter(r => r.id && isRowDirty(r)).map(r => api.updateBus(String(r.id), { ...r, managerId: r.managerId ? Number(r.managerId) : null, registrationNumber: r.registrationNumber.trim() || null, driverTel: normalizePhoneNumber(r.driverTel) || null, tourGuideTel: normalizePhoneNumber(r.tourGuideTel) || null })),
        ...deletedIds.map(id => api.deleteBus(String(id)))
      ]);
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const columns = buildBusColumns({ managers, attendanceSummary: busAttendanceSummary, handleCellChange, handleDeleteRow});

  return (
    <div className="animate-fade-in p-0 p-md-3 bus-page" style={pageThemeVars}>
      <PageTitle icon={<Bus size={20} />} title="Quản lý Đội xe" />

      <EditableTableCard
          title="Thông tin chi tiết đội xe"
          titleActions={<SaveChangesAction dirtyCount={dirtyCount} isSaving={isSaving} canSave={canSave} onSave={handleSave} validationMessage={saveValidationMessage} />}
          columns={columns}
          queryKey={['buses-local', tripId]}
          data={rows}
          isLoading={isPageLoading}
          isError={isError}
          onRefresh={() => { setDeletedIds([]); setRows(prev => prev.filter(r => r.id || isNewRowDirty(r))); refetch(); }}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
          showAddRow
          onAddRow={handleAddRow}
        />
    </div>
  );
};

export default BusPage;
