import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { buildTransactionColumns } from './transaction/columns';
import type {
  DraftCell,
  TransactionTableRow,
} from './transaction/types';
import { keyOf } from './transaction/types';
import TransactionFilters from './transaction/TransactionFilters';
import { useTransactionSync } from './transaction/useTransactionSync';
import { useTransactionData } from './transaction/useTransactionData';
import { useTransactionDraftStorage } from './transaction/useTransactionDraftStorage';
import { useTransactionMap } from './transaction/useTransactionMap';
import { useTransactionRealtime } from './transaction/useTransactionRealtime';
import { buildLockedAttendanceMessage, isSameCell } from './transaction/helpers';
import { useDisplayedPassengers } from './transaction/useDisplayedPassengers';
import { useExtraPassengers } from './transaction/useExtraPassengers';
import { useTransactionSelection, useTransactionSelectionDataSync } from './transaction/useTransactionSelection';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { useSnackbar } from 'notistack';
import { useSelector } from 'react-redux';
import ExtraPassengerPanel from './transaction/ExtraPassengerPanel';  
import ExportExcelButton from './transaction/ExportExcelButton';
import TransactionHeader from './transaction/TransactionHeader';
import ConfirmRoundPanel from './transaction/ConfirmRoundPanel';
import { useRoundLocks } from '../../hooks/useRoundLocks';
import CompleteRoundPanel from './transaction/CompleteRoundPanel';
import './TransactionPage.css';
import EditableTableCard from '../../components/admin/EditableTableCard';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import type { RootState } from '../../redux/store';
import { ROLE_IDS } from '../../auth/rbac';

type AttendanceDisplayMode = 'all' | 'checkIn' | 'checkOut';


const TransactionPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const currentTenantId = useSelector((state: RootState) => state.auth.currentTenant?.id ?? null);
  const roleId = useSelector((state: RootState) => state.auth.roleId ?? null);
  const canMutateTransactions = roleId === ROLE_IDS.BUS_MANAGEMENT;
  const pageThemeVars = usePageThemeVars();

  // draftMap lưu trạng thái người dùng vừa sửa trên UI trước khi MQTT worker ghi xong DB.
  // Nhờ vậy checkbox/ghi chú phản hồi ngay cả khi đang chờ ACK, refetch hoặc mạng chậm.
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [attendanceDisplayMode, setAttendanceDisplayMode] = useState<AttendanceDisplayMode>('all');

  const {
    selectedTripId,
    setSelectedTripId,
    selectedBusIds,
    setSelectedBusIds,
    selectedRoundIds,
    setSelectedRoundIds,
    tripDropdownOpen,
    setTripDropdownOpen,
    busDropdownOpen,
    setBusDropdownOpen,
    roundDropdownOpen,
    setRoundDropdownOpen,
    departureRoundFilter,
    setDepartureRoundFilter,
    returnRoundFilter,
    setReturnRoundFilter,
    filterDropdownRef,
  } = useTransactionSelection();

  // Khi đổi tenant, reset selection và draftMap để tránh lẫn dữ liệu giữa các tenant.
  useEffect(() => {
    setSelectedTripId(null);
    setSelectedBusIds([]);
    setSelectedRoundIds([]);
    setDraftMap({});
  }, [currentTenantId]);

  // Hook này gom toàn bộ API query cần cho trang transaction.
  const {
    trips,
    tripsLoading,
    buses,
    busesLoading,
    rounds,
    roundsLoading,
    passengers,
    passengersLoading,
    transactions,
    transactionsLoading,
    refetchPassengers,
    refetchTransactions,
    busRoundStatuses,
    refetchBusRoundStatuses,
  } = useTransactionData(selectedTripId);

  // Hook này đồng bộ selection với dữ liệu API, ví dụ khi đổi trip thì reset bus/round selection.
  useTransactionSelectionDataSync({
    trips,
    buses,
    rounds,
    selectedTripId,
    setSelectedTripId,
    selectedRoundIds,
    setSelectedBusIds,
    setSelectedRoundIds,
    departureRoundFilter,
    setDepartureRoundFilter,
    returnRoundFilter,
    setReturnRoundFilter,
  });

  // Dữ liệu transaction theo key passengerId_roundId.
  const txMap = useTransactionMap(transactions);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => Number(a.id) - Number(b.id)),
    [rounds]
  );

  // Chỉ lấy các chặng đang được chọn để dựng cột bảng và xuất file theo thứ tự id chặng.
  const selectedRounds = useMemo(
    () => sortedRounds.filter((r) => selectedRoundIds.includes(Number(r.id))),
    [sortedRounds, selectedRoundIds]
  );

  // Lưu draft local/offline để reload trang vẫn giữ thao tác chưa sync xong.
  const storageKey = useTransactionDraftStorage({
    selectedTripId,
    draftMap,
    setDraftMap,
    refetchTransactions,
    refetchPassengers,
  });

  // Tìm xe thực tế của hành khách ở một chặng: ưu tiên transaction đã có, fallback về xe được phân công.
  const getActualBusId = (
    passengerId: number,
    roundId: number,
    assignedBusId?: number | null
  ) => {
    const key = keyOf(passengerId, roundId);
    const txCell = txMap[key];

    if (txCell?.checkOutBusId) {
      return Number(txCell.checkOutBusId);
    }
    if (txCell?.checkInBusId) {
      return Number(txCell.checkInBusId);
    }
    if (txCell?.busId) {
      return Number(txCell.busId);
    }
    if (assignedBusId) {
      return Number(assignedBusId);
    }

    return null;
  };

  // Hook khóa lượt dùng actual bus id để biết ô check-in/check-out nào không được sửa.
  const { isLocked, lockStatuses, refetchLocks } = useRoundLocks(
    selectedTripId,
    getActualBusId
  );


  // Lắng nghe MQTT để bảng tự cập nhật khi trưởng xe khác thay đổi điểm danh hoặc khóa lượt.
  useTransactionRealtime({
    selectedTripId,
    refetchBusRoundStatuses,
    refetchLocks,
    refetchPassengers,
    refetchTransactions,
  });

  // Sau khi server trả dữ liệu mới, xóa draft đã trùng DB.
  useEffect(() => {
    setDraftMap((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([key, draft]) => {
        if (isSameCell(draft, txMap[key])) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [txMap]);

  const {
    displayedPassengers,
    existingPassengerIds,
    assignedBusByPassengerId,
  } = useDisplayedPassengers({
    passengers,
    transactions,
    selectedBusIds,
    buses,
  });

  const {
    showAddPassengerPanel,
    setShowAddPassengerPanel,
    extraPassengers,
    extraPassengerRoundConfirmed,
    addExtraPassenger,
    removeExtraPassenger,
    handleConfirmAllExtraPassengers,
    handleRemovePassengerFromTransaction,
    canRemovePassenger,
  } = useExtraPassengers({
    selectedTripId,
    selectedBusIds,
    selectedRoundIds,
    selectedRounds,
    busRoundStatuses,
    transactions,
    assignedBusByPassengerId,
    setDraftMap,
    refetchTransactions,
    refetchPassengers,
  });

  // Lấy dữ liệu trong ô để render bảng ưu tiên sử dụng draftMap trước sau đó mới là txMap
  const getCell = (passengerId: number, roundId: number): DraftCell | null => {
    const key = keyOf(passengerId, roundId);
    const draft = draftMap[key];
    const base = txMap[key];
    if (!draft) return base || null;

    return {
      ...draft,
      checkInBusId: draft.checkInBusId ?? base?.checkInBusId ?? draft.busId,
      checkOutBusId: draft.checkOutBusId ?? base?.checkOutBusId ?? draft.busId,
      checkInNote: draft.checkInNoteTouched ? draft.checkInNote : base?.checkInNote ?? draft.checkInNote,
      checkOutNote: draft.checkOutNoteTouched ? draft.checkOutNote : base?.checkOutNote ?? draft.checkOutNote,
    };
  };

  // Ghi thay đổi vào draftMap sau đó hệ thống tự sync với DB qua MQTT worker. Nếu ô bị lock thì không cho sửa và cảnh báo.
  const setCell = (payload: Partial<DraftCell>) => {
    if (!canMutateTransactions) {
      return;
    }

    if (payload.passengerId === undefined || payload.roundId === undefined || payload.busId === undefined) {
      return;
    }

    const key = keyOf(payload.passengerId, payload.roundId);
    const baseCell = txMap[key];

    const lockedIn = isLocked(
      payload.passengerId,
      payload.busId,
      Number(payload.roundId),
      'checkIn'
    );

    const lockedOut = isLocked(
      payload.passengerId,
      payload.busId,
      Number(payload.roundId),
      'checkOut'
    );

    const changingCheckIn =
      payload.checkIn !== undefined
        ? baseCell
          ? payload.checkIn !== baseCell.checkIn
          : payload.checkIn === true
        : false;

    const changingCheckInNote =
      payload.checkInNote !== undefined
        ? baseCell
          ? payload.checkInNote !== baseCell.checkInNote
          : (payload.checkInNote ?? '').trim() !== ''
        : false;

    const changingCheckOut =
      payload.checkOut !== undefined
        ? baseCell
          ? payload.checkOut !== baseCell.checkOut
          : payload.checkOut === true
        : false;

    const changingCheckOutNote =
      payload.checkOutNote !== undefined
        ? baseCell
          ? payload.checkOutNote !== baseCell.checkOutNote
          : (payload.checkOutNote ?? '').trim() !== ''
        : false;

    if (
      (lockedIn && (changingCheckIn || changingCheckInNote)) ||
      (lockedOut && (changingCheckOut || changingCheckOutNote))
    ) {
      enqueueSnackbar(
        buildLockedAttendanceMessage({
          lockedIn,
          lockedOut,
          changingCheckIn,
          changingCheckInNote,
          changingCheckOut,
          changingCheckOutNote,
        }),
        { variant: 'warning' }
      );
      return;
    }

    const defaultCell: DraftCell = {
      passengerId: payload.passengerId,
      roundId: payload.roundId,
      busId: payload.busId,
      checkIn: false,
      checkOut: false,
      checkInNote: '',
      checkOutNote: '',
      checkInBusId: payload.busId,
      checkOutBusId: payload.busId,
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as Partial<DraftCell>;

    const merged: DraftCell = {
      ...defaultCell,
      ...baseCell,
      ...draftMap[key],
      ...cleanPayload,
    };

    // So sánh draft mới với dữ liệu gốc để biết ô này có thật sự cần lưu hay không.
    const isDirty = !isSameCell(merged, baseCell);

    setDraftMap((prev) => ({
      ...prev,
      [key]: {
        ...merged,
        dirty: isDirty,
      },
    }));
  };

  // Kiểm tra hành khách có mặt ở một chặng theo hướng lượt đi hoặc lượt về.
  const isPresentAtRound = (passengerId: number, roundId: number, direction: 'checkIn' | 'checkOut') => {
    const cell = getCell(passengerId, roundId);
    return Boolean(cell?.[direction]);
  };

  // Lọc danh sách hiển thị theo dropdown "Lượt đi" và "Lượt về".
  const visiblePassengers = useMemo(() => {
    return displayedPassengers.filter((p) => {
      if (departureRoundFilter && !isPresentAtRound(p.id, departureRoundFilter, 'checkIn')) {
        return false;
      }

      if (returnRoundFilter && !isPresentAtRound(p.id, returnRoundFilter, 'checkOut')) {
        return false;
      }

      return true;
    });
  }, [displayedPassengers, departureRoundFilter, returnRoundFilter, txMap, draftMap]);

  // Những ô khác DB sẽ được coi là dirty và đưa vào queue lưu/sync.
  // So sánh draftMap với txMap giúp biết chính xác ô nào cần gửi lên MQTT.
  const dirtyEntries = useMemo(
    () => Object.values(draftMap).filter((entry) => !isSameCell(entry, txMap[keyOf(entry.passengerId, entry.roundId)])),
    [draftMap, txMap]
  );

  // Hook này xử lý lưu/sync dirty entries, bao gồm cả chế độ offline.
  useTransactionSync({
    dirtyEntries,
    enabled: canMutateTransactions && !transactionsLoading,
    selectedTripId,
    storageKey,
  });

  useRegisterUnsavedChanges(false);

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  return (
    <div className="animate-fade-in p-0 p-md-3 transaction-page pb-5" style={pageThemeVars}>
          <TransactionHeader>{null}</TransactionHeader>
      {/* Filters Toolbar - Đã gọn hóa */}
      <div className="transaction-filter-card p-3 mb-4 shadow-sm">
        <div ref={filterDropdownRef}>
        <TransactionFilters
            trips={trips} 
            buses={buses} 
            rounds={sortedRounds}
            selectedTripId={selectedTripId} 
            selectedBusIds={selectedBusIds} 
            selectedRoundIds={selectedRoundIds}
            tripDropdownOpen={tripDropdownOpen}
            busDropdownOpen={busDropdownOpen} 
            roundDropdownOpen={roundDropdownOpen}
            setSelectedTripId={setSelectedTripId} 
            setTripDropdownOpen={setTripDropdownOpen}
            setBusDropdownOpen={setBusDropdownOpen} 
            setRoundDropdownOpen={setRoundDropdownOpen}
            toggleBus={(id) => setSelectedBusIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            toggleRound={(id) => setSelectedRoundIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onTripChange={() => setDraftMap({})}
          />
        </div>
        
        <div className="transaction-filter-extra mt-3 pt-3 border-top d-flex flex-column gap-3">
            <div className="d-flex flex-wrap align-items-center gap-3">
              
              {canMutateTransactions && (
                <button
                  className="btn-outline-custom flex-grow-1 flex-md-grow-0"
                  onClick={() => setShowAddPassengerPanel(!showAddPassengerPanel)}
                >
                  <UserPlus size={16} /> <span className="ms-1">Khách ngoài biên chế</span>
                </button>
              )}

              <div className="col-12 col-lg flex-grow-1">
               <div className="row g-2">
                <div className="col-12 col-sm-6 d-flex align-items-center gap-2">
                  <label className="transaction-round-filter-label text-nowrap small fw-bold mb-0">
                    Lượt đi:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={departureRoundFilter ?? ''} 
                    onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="col-12 col-sm-6 d-flex align-items-center gap-2">
                  <label className="transaction-round-filter-label text-nowrap small fw-bold mb-0">
                    Lượt về:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={returnRoundFilter ?? ''} 
                    onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                </div>
              </div>
            </div>
           {canMutateTransactions && (
             <ExtraPassengerPanel
                show={showAddPassengerPanel}
                passengers={passengers}
                buses={buses}
                selectedBusIds={selectedBusIds}
                existingPassengerIds={existingPassengerIds}
                extraPassengers={extraPassengers}
                onAdd={addExtraPassenger}
                onRemove={removeExtraPassenger}
                onConfirmAll={handleConfirmAllExtraPassengers}
                confirmDisabled={extraPassengerRoundConfirmed}
                confirmDisabledReason="Chặng đã xác nhận hoàn tất nên không thể thêm khách ngoài biên chế."
                onClose={() => setShowAddPassengerPanel(false)}
              />
           )}
              
        </div>
      </div>

      <EditableTableCard<TransactionTableRow>
          title="Danh sách điểm danh"
          titleActions={
            <>
              <div className="attendance-display-switch d-flex flex-wrap align-items-center gap-2">
                {[
                  { value: 'all', label: 'Đầy đủ' },
                  { value: 'checkIn', label: 'Lượt đi' },
                  { value: 'checkOut', label: 'Lượt về' },
                ].map((option) => {
                  const active = attendanceDisplayMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`attendance-display-option ${active ? 'active' : ''}`}
                      onClick={() => setAttendanceDisplayMode(option.value as AttendanceDisplayMode)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <ExportExcelButton
                visiblePassengers={visiblePassengers}
                selectedRounds={selectedRounds}
                trips={trips}
                selectedTripId={selectedTripId}
                buses={buses}
                getCell={getCell}
              />
            </>
          }
          queryKey={['transaction-table', selectedTripId, selectedBusIds.join(','), selectedRoundIds.join(','), departureRoundFilter, returnRoundFilter]}
          data={visiblePassengers}
          columns={buildTransactionColumns({
            selectedRounds,
            displayMode: attendanceDisplayMode,
            readOnly: !canMutateTransactions,
            getCell,
            setCell,
            isLocked,
            onRemovePassenger: handleRemovePassengerFromTransaction,
            canRemovePassenger,
          })}
          isLoading={isLoading}
          initialPageSize={50}
          onRefresh={() => { refetchTransactions(); refetchPassengers(); refetchLocks(); }}
        >
      {canMutateTransactions && (
        <div className="bento-action-hub shadow-sm">
          <div className="d-flex flex-column gap-2">
          <ConfirmRoundPanel
              selectedRounds={selectedRounds}
              selectedBusIds={selectedBusIds}
            lockStatuses={lockStatuses}
              onSuccess={() => { refetchTransactions(); refetchLocks(); }}
          />
          <CompleteRoundPanel
              selectedRounds={selectedRounds}
              selectedBusIds={selectedBusIds}
              buses={buses}
              busRoundStatuses={busRoundStatuses}
              onSuccess={() => { refetchTransactions(); refetchLocks(); refetchBusRoundStatuses(); }}
            />
        </div>
        </div>
      )}
      </EditableTableCard>
    </div>
  );
};

export default TransactionPage;

