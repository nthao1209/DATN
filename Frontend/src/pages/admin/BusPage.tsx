import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Bus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../../utils/phone';
import { buildBusColumns } from './bus/columns';
import { useTheme } from '../../theme/ThemeContext';
import './BusPage.css';
import type { TransactionRecord } from '../bus-management/transaction/types';
import type { BusManager, BusRow } from './bus/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;
const EMPTY_BUSES: any[] = [];
const EMPTY_MANAGERS: BusManager[] = [];
const EMPTY_TRANSACTIONS: TransactionRecord[] = [];

const BusPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); 
  const { enqueueSnackbar } = useSnackbar();
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
    queryKey: ['transactions', tripId],
    queryFn: api.getTransactions,
    enabled: !!tripId,
  });

  const transactions = transactionsData ?? EMPTY_TRANSACTIONS;

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

  const isRowValid = (row: BusRow) => Boolean(
    row.busCode.trim() &&
    row.registrationNumber.trim() &&
    row.managerId
  );

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
      if (!row.registrationNumber.trim()) missing.add('Biển số');
      if (!row.managerId) missing.add('Trưởng xe');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && isNewRowDirty(r)).length;
    const edited = rows.filter((r) => r.id && isRowDirty(r)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;

  const busAttendanceSummary = useMemo(() => {
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

  const pageThemeVars = {
    '--page-primary': colors.primary,
    '--page-primary-11': `${colors.primary}11`,
    '--page-primary-22': `${colors.primary}22`,
    '--page-surface-light': colors.surfaceLight,
    '--page-background': colors.background,
    '--page-border': colors.border,
    '--page-border-light': colors.borderLight,
    '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
    '--page-table-header-text': isDarkMode ? colors.textSecondary : '#475569',
  };

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
        ...rows.filter(r => !r.id && r.busCode.trim()).map(r => api.createBus(tripId, { ...r, managerId: Number(r.managerId), driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...rows.filter(r => r.id && isRowDirty(r)).map(r => api.updateBus(String(r.id), { ...r, driverTel: normalizePhoneNumber(r.driverTel), tourGuideTel: normalizePhoneNumber(r.tourGuideTel) })),
        ...deletedIds.map(id => api.deleteBus(String(id)))
      ]);
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const columns = buildBusColumns({ managers, attendanceSummary: busAttendanceSummary, handleCellChange, handleDeleteRow});

  return (
    <div className="animate-fade-in p-0 p-md-3 bus-page" style={pageThemeVars as React.CSSProperties}>
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
        
        {/* refresh button removed */}
      </div>


      {/* Bọc Table trong một Card có shadow nhẹ */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Thông tin chi tiết đội xe"
          titleActions={dirtyCount > 0 ? (
            <div className="d-flex flex-column align-items-end gap-1">
              <button
                className="btn-custom-action-save shadow-sm save-floating-action"
                onClick={handleSave}
                disabled={isSaving || !canSave}
                title={saveValidationMessage || undefined}
                style={{ 
                  backgroundColor: canSave ? colors.success : colors.surfaceLight, 
                  color: canSave ? '#fff' : colors.textMuted
                }}
              >
                <Save size={16} />
                <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
                <span className="d-inline d-sm-none">{dirtyCount}</span>
              </button>
              {saveValidationMessage && (
                <div className="small text-end" style={{ color: colors.warning, maxWidth: '320px', lineHeight: 1.2 }}>
                  {saveValidationMessage}
                </div>
              )}
            </div>
          ) : null}
          columns={columns}
          queryKey={['buses-local', tripId]}
          data={rows}
          isLoading={isPageLoading}
          isError={isError}
          onRefresh={() => { setDeletedIds([]); setRows(prev => prev.filter(r => r.id || isNewRowDirty(r))); refetch(); }}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
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
    </div>
  );
};

export default BusPage;