import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Map, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { buildRoundColumns } from './round/columns';
import { useRoundLocks } from '../../hooks/useRoundLocks';
import { useTheme } from '../../theme/ThemeContext'; 
import './RoundPage.css';
import type { RoundRow } from './round/types';
import LockRoundModal from './round/LockRoundModal';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { subscribeMqttTopics } from '../../services/mqtt';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const RoundPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { id: tripId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, RoundRow>>({});
  const [openLockModal, setOpenLockModal] = useState<{
    roundId: number;
    lockType: 'check_in' | 'check_out';
  } | null>(null);

  // --- DATA FETCHING ---
  const { data: rounds = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['rounds', tripId],
    queryFn: () => api.getRounds(String(tripId)),
    enabled: !!tripId,
  });

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ['round-transactions', tripId],
    queryFn: () => api.getTransactions(),
    enabled: !!tripId,
  });

  const { lockStatuses = [], refetchLocks } = useRoundLocks(
    tripId ? Number(tripId) : null,
    () => null
  );

  const { data: buses = [] } = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });
  const { data: unlockRequests = [], refetch: refetchUnlockRequests } = useQuery<any[]>({
    queryKey: ['unlock-requests', tripId, openLockModal?.roundId],
    queryFn: async () => {
      const response = await api.getPendingUnlockRequests(String(tripId), String(openLockModal?.roundId));
      return Array.isArray(response) ? response : [];
    },
    enabled: !!tripId && !!openLockModal?.roundId,
  });

  

  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // Realtime updates MQTT
  useEffect(() => {
    const subscription = subscribeMqttTopics(['attendance/ui/locks'], (_topic, message: any) => {
      if (message.type === 'bus.round.lock.updated') {
        queryClient.setQueryData(['bus-round-locks', tripId], (oldData: any[]) => {
          if (!oldData) return oldData;
          return oldData.map((item) =>
            Number(item.busId) === message.busId && Number(item.roundId) === message.roundId
              ? {
                  ...item,
                  checkInLocked: message.checkInLocked,
                  checkOutLocked: message.checkOutLocked,
                }
              : item
          );
        });
        refetchLocks();
      }
      if (
        message.type === 'unlock.request.created' ||
        message.type === 'unlock.request.approved' ||
        message.type === 'unlock.request.rejected'
      ) {
        refetchUnlockRequests();
      }
    });

    return () => {
      subscription.end(true);
    };
  }, [queryClient, tripId, refetchLocks, refetchUnlockRequests]);

  useEffect(() => {
    const mapped: RoundRow[] = rounds.map((r: any) => {
      const roundId = Number(r.id);
      const checkInTxCount = (transactions || []).filter((tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === roundId && Boolean(tx.checkIn)).length;
      const checkOutTxCount = (transactions || []).filter((tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === roundId && Boolean(tx.checkOut)).length;

      const lockedInCount = (lockStatuses || []).filter((s: any) => Number(s.roundId) === roundId && Boolean(s.checkInLocked)).length;
      const lockedOutCount = (lockStatuses || []).filter((s: any) => Number(s.roundId) === roundId && Boolean(s.checkOutLocked)).length;
      const busCount = Number(r?.busCount ?? buses.length ?? 0);
      const completedBusCount = Number(r?.completedBusCount ?? 0);

      return {
        id: roundId,
        localId: `db_${r.id}`,
        name: r.name || '',
        time: r.time || '',
        status: r.status === 'DONE' ? 'DONE' : 'DOING',
        transactionCount: Number(checkInTxCount),
        checkInCount: Number(checkInTxCount),
        checkOutCount: Number(checkOutTxCount),
        passengerCount: Number(r?.passengerCount || 0),
        busCount,
        completedBusCount,
        lockedInCount,
        lockedOutCount,
      } as RoundRow;
    });

    const initialById: Record<number, RoundRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        time: '',
        status: 'DOING',
        transactionCount: 0,
        passengerCount: 0,
        busCount: buses.length,
        completedBusCount: 0,
      });
    }
    setRows(padded);
  }, [rounds, transactions, lockStatuses, buses]);

  const isSameRow = (current: RoundRow, initial: RoundRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      current.time.trim() === initial.time.trim() &&
      current.status === initial.status
    );
  };

  const isNewRowDirty = (row: RoundRow) => {
    return Boolean(row.name.trim() || row.time.trim() || row.status !== 'DOING');
  };

  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: RoundRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const isRowValid = (row: RoundRow) => Boolean(row.name.trim() && row.time.trim());

  const hasValidationErrors = useMemo(
    () => rows.some((row) => isRowDirty(row) && !isRowValid(row)),
    [rows]
  );

  const saveValidationMessage = useMemo(() => {
    if (!hasValidationErrors) return '';
    const missing = new Set<string>();
    rows.forEach((row) => {
      if (!isRowDirty(row)) return;
      if (!row.name.trim()) missing.add('Tên chặng');
      if (!row.time.trim()) missing.add('Thời gian');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && isNewRowDirty(r)).length;
    const edited = rows.filter((r) => r.id && isRowDirty(r)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;
  const pageThemeVars = {
    '--page-primary': colors.primary,
    '--page-primary-11': `${colors.primary}11`,
    '--page-primary-15': `${colors.primary}15`,
    '--page-primary-33': `${colors.primary}33`,
    '--page-surface-light': colors.surfaceLight,
    '--page-background': colors.background,
    '--page-border': colors.border,
    '--page-border-light': colors.borderLight,
    '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
    '--page-table-header-text': isDarkMode ? colors.textSecondary : '#475569',
  };

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof RoundRow>(localId: string, key: K, value: RoundRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const nextRow = { ...row, [key]: value };
        if (!row.id) return nextRow;
        const initial = initialRowsByIdRef.current[row.id];
        const isEdited = initial ? !isSameRow(nextRow, initial) : true;
        return { ...nextRow, isEdited };
      })
    );
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
      return [
        ...prev,
        {
          localId,
          name: '',
          time: '',
          status: 'DOING',
          transactionCount: 0,
          passengerCount: 0,
          busCount: 0,
          completedBusCount: 0,
        },
      ];
    });
  };

  const handleDeleteRow = (row: RoundRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (!tripId) return;
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ tên chặng và thời gian trước khi lưu', { variant: 'warning' });
      return;
    }
    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim() && r.time.trim());
    const rowsToUpdate = rows.filter((r) => r.id && isRowDirty(r));

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((r) => api.createRound(tripId, { name: r.name.trim(), time: r.time.trim(), status: r.status })),
        ...rowsToUpdate.map((r) => api.updateRound(String(r.id), { name: r.name.trim(), time: r.time.trim(), status: r.status })),
        ...deletedIds.map((id) => api.deleteRound(String(id))),
      ]);
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildRoundColumns({
    handleCellChange,
    handleDeleteRow,
    openLocksForRound: (roundId: number, lockType: 'check_in' | 'check_out') => {
      setOpenLockModal({ roundId, lockType });
    },
  });

  const toggleLock = async (
    busId: number,
    roundId: number,
    value: boolean,
    lockType: 'check_in' | 'check_out'
  ) => {
    const key = `${busId}_${roundId}_${lockType}`;
    setToggling((s) => ({ ...s, [key]: true }));
    try {
      await api.confirmBusRoundChecks(
        Number(busId),
        Number(roundId),
        lockType === 'check_in' ? { checkInLocked: value } : { checkOutLocked: value }
      );
      enqueueSnackbar(
        `${value ? 'Đã khóa' : 'Đã mở khóa'} ${lockType === 'check_in' ? 'lượt đi' : 'lượt về'} cho xe ${busId}`,
        { variant: 'success' }
      );
      refetchLocks();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi cập nhật khóa', { variant: 'error' });
    } finally {
      setToggling((s) => ({ ...s, [key]: false }));
    }
  };

  const handleUnlockRequest = async (
  requestId: number,
  status: 'APPROVED' | 'REJECTED',
  rejectReason?: string
) => {
  try {
    if (status === 'APPROVED') {
      await api.approveUnlockRequest(requestId);
    } else {
      await api.rejectUnlockRequest(requestId, {
        rejectReason,
      });
    }

    enqueueSnackbar(
      status === 'APPROVED'
        ? 'Đã phê duyệt yêu cầu mở khóa'
        : 'Đã từ chối yêu cầu mở khóa',
      {
        variant:
          status === 'APPROVED'
            ? 'success'
            : 'info',
      }
    );

    await Promise.all([
      refetchUnlockRequests(),
      refetchLocks(),
    ]);
  } catch (err: any) {
    enqueueSnackbar(
      err?.message ||
        'Lỗi khi xử lý yêu cầu mở khóa',
      {
        variant: 'error',
      }
    );

    throw err;
  }
};
  return (
    <div className="animate-fade-in p-0 p-md-3 round-page" style={pageThemeVars as React.CSSProperties}>
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
            <Map size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
            Quản lý Chặng đi
          </h1>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => { setDeletedIds([]); refetch(); refetchUnlockRequests(); }}
          title="Làm mới dữ liệu"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      {/* Table Section */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách các chặng"
          titleActions={
            <div className="d-flex flex-column align-items-end gap-1">
              <button
                className="btn-custom-action-save shadow-sm"
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
                <div className="small text-end" style={{ color: colors.warning, maxWidth: '280px', lineHeight: 1.2 }}>
                  {saveValidationMessage}
                </div>
              )}
            </div>
          }
          columns={columns}
          queryKey={['rounds-local', tripId]}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
        />
        
        {openLockModal !== null && (
          <LockRoundModal 
            roundId={openLockModal.roundId}
            lockType={openLockModal.lockType}
            onClose={() => setOpenLockModal(null)}
            lockStatuses={lockStatuses}
            buses={buses}
            toggling={toggling}
            onToggleLock={toggleLock}
            unlockRequests={unlockRequests}
            onHandleUnlockRequest={handleUnlockRequest}

            colors={colors}
            isDarkMode={isDarkMode}
          />
        )}
        
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

export default RoundPage;