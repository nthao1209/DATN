import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { buildRoundColumns } from './round/columns';
import { useTheme } from '../../theme/ThemeContext';
import './RoundPage.css';
import type { RoundRow } from './round/types';
import { buildRoundRows, isNewRoundRowDirty, isSameRoundRow, makeRoundLocalId } from './round/helpers';
import LockRoundModal from './round/LockRoundModal';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import { useAttendanceRealtimeInvalidation } from '../../hooks/useAttendanceRealtimeInvalidation';
import { useEditableRows } from '../../hooks/useEditableRows';
import { useRoundLockManagement } from './round/useRoundLockManagement';

const EMPTY_ROUNDS: any[] = [];
const EMPTY_TRANSACTIONS: any[] = [];
const EMPTY_BUSES: any[] = [];

const createEmptyRoundRow = (): RoundRow => ({
  localId: makeRoundLocalId(),
  name: '',
  time: '',
  status: 'DOING',
  transactionCount: 0,
  passengerCount: 0,
  busCount: 0,
  completedBusCount: 0,
});

const RoundPage: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const { id: tripId } = useParams<{ id: string }>();
  const [isSaving, setIsSaving] = useState(false);

  const { data: roundsData, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['rounds', tripId],
    queryFn: () => api.getRounds(String(tripId)),
    enabled: !!tripId,
  });
  const rounds = roundsData ?? EMPTY_ROUNDS;

  const { data: transactionsData } = useQuery<any[]>({
    queryKey: ['round-transactions', tripId],
    queryFn: () => api.getTransactions(),
    enabled: !!tripId,
  });
  const transactions = transactionsData ?? EMPTY_TRANSACTIONS;

  const roundRealtimeQueryKeys = useMemo(
    () => [
      ['round-transactions', tripId],
      ['rounds', tripId],
      ['bus-round-locks', tripId],
    ],
    [tripId]
  );

  useAttendanceRealtimeInvalidation({
    tripId: tripId ? Number(tripId) : null,
    queryKeys: roundRealtimeQueryKeys,
  });

  const {
    openLockModal,
    setOpenLockModal,
    lockStatuses,
    unlockRequests,
    refetchUnlockRequests,
    toggling,
    toggleLock,
    handleUnlockRequest,
  } = useRoundLockManagement({ tripId, enqueueSnackbar });

  const { data: busesData } = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });
  const buses = busesData ?? EMPTY_BUSES;

  const {
    rows,
    deletedIds,
    resetDeletedIds,
    focusRowKey,
    focusRowSignal,
    isRowDirty,
    dirtyCount,
    handleCellChange,
    handleAddRow,
    handleDeleteRow,
  } = useEditableRows<RoundRow>({
    buildRows: () => buildRoundRows({ rounds, transactions, lockStatuses, buses }),
    resetDeps: [rounds, transactions, lockStatuses, buses],
    isSameRow: isSameRoundRow,
    isNewRowDirty: isNewRoundRowDirty,
    createRow: createEmptyRoundRow,
  });

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

  const canSave = dirtyCount > 0 && !hasValidationErrors;
  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleSave = async () => {
    if (!tripId) return;
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ tên chặng và thời gian trước khi lưu', { variant: 'warning' });
      return;
    }

    const rowsToCreate = rows.filter((row) => !row.id && row.name.trim() && row.time.trim());
    const rowsToUpdate = rows.filter((row) => row.id && isRowDirty(row));

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((row) => api.createRound(tripId, { name: row.name.trim(), time: row.time.trim(), status: row.status })),
        ...rowsToUpdate.map((row) => api.updateRound(String(row.id), { name: row.name.trim(), time: row.time.trim(), status: row.status })),
        ...deletedIds.map((id) => api.deleteRound(String(id))),
      ]);
      resetDeletedIds();
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

  return (
    <div className="animate-fade-in p-0 p-md-3 round-page" style={pageThemeVars}>
      <PageTitle icon={<Map size={22} />} title="Quản lý Chặng đi" />

      <EditableTableCard
        title="Danh sách các chặng"
        titleActions={
          <SaveChangesAction
            dirtyCount={dirtyCount}
            isSaving={isSaving}
            canSave={canSave}
            onSave={handleSave}
            validationMessage={saveValidationMessage}
            messageMaxWidth="280px"
          />
        }
        columns={columns}
        queryKey={['rounds-local', tripId]}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRefresh={() => {
          resetDeletedIds();
          refetch();
          refetchUnlockRequests();
        }}
        focusRowKey={focusRowKey}
        focusRowSignal={focusRowSignal}
        showAddRow
        onAddRow={handleAddRow}
      >
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
      </EditableTableCard>
    </div>
  );
};

export default RoundPage;
