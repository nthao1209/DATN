import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSnackbar } from 'notistack';
import api from '../../../services/api';
import type { BusRoundStatus, DraftCell, PassengerRow, RoundOption, TransactionRecord } from './types';

export const useExtraPassengers = ({
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
}: {
  selectedTripId: number | null;
  selectedBusIds: number[];
  selectedRoundIds: number[];
  selectedRounds: RoundOption[];
  busRoundStatuses: BusRoundStatus[];
  transactions: TransactionRecord[];
  assignedBusByPassengerId: Map<number, number | null>;
  setDraftMap: Dispatch<SetStateAction<Record<string, DraftCell>>>;
  refetchTransactions: () => Promise<unknown>;
  refetchPassengers: () => Promise<unknown>;
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [showAddPassengerPanel, setShowAddPassengerPanel] = useState(false);
  const [extraPassengers, setExtraPassengers] = useState<PassengerRow[]>([]);

  useEffect(() => {
    setExtraPassengers([]);
    setShowAddPassengerPanel(false);
  }, [selectedTripId]);

  const extraPassengerTargetBusId = selectedBusIds.length === 1
    ? Number(selectedBusIds[0])
    : selectedBusIds[0] ?? null;

  const extraPassengerRoundConfirmed = useMemo(() => {
    if (!extraPassengerTargetBusId || !selectedRounds.length) {
      return false;
    }

    return selectedRounds.some((round) => {
      const status = busRoundStatuses.find(
        (item) =>
          Number(item.busId) === Number(extraPassengerTargetBusId) &&
          Number(item.roundId) === Number(round.id)
      );

      return Boolean(status?.driverConfirmedBy);
    });
  }, [busRoundStatuses, extraPassengerTargetBusId, selectedRounds]);

  const addExtraPassenger = (passenger: PassengerRow) => {
    setExtraPassengers((prev) => {
      if (prev.some((item) => item.id === passenger.id)) return prev;
      return [...prev, passenger];
    });
  };

  const canRemovePassenger = (row: PassengerRow) => {
    const assignedBusId = assignedBusByPassengerId.get(Number(row.id));
    if (!assignedBusId) return false;
    return !selectedBusIds.includes(Number(assignedBusId));
  };

  const handleRemovePassengerFromTransaction = async (row: PassengerRow) => {
    if (!selectedTripId) return;

    if (!canRemovePassenger(row)) {
      enqueueSnackbar('Không được xóa khách thuộc biên chế xe bạn quản lý. Chỉ được xóa khách thuộc xe khác.', { variant: 'warning' });
      return;
    }

    const ok = window.confirm(`Xóa khách ${row.name} khỏi transaction của chuyến hiện tại?`);
    if (!ok) return;

    try {
      const txToDelete = transactions.filter((tx) => {
        const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
        const tripId = Number(tx.round?.tripId ?? 0);
        return passengerId === Number(row.id) && tripId === Number(selectedTripId);
      });

      if (txToDelete.length > 0) {
        await Promise.all(txToDelete.map((tx) => api.deleteTransaction(String(tx.id))));
      }

      setDraftMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${row.id}_`)) {
            delete next[key];
          }
        });
        return next;
      });

      setExtraPassengers((prev) => prev.filter((passenger) => passenger.id !== row.id));

      await Promise.all([refetchTransactions(), refetchPassengers()]);
      enqueueSnackbar('Đã xóa khách khỏi bảng điểm danh', { variant: 'success' });
    } catch (error: any) {
      const message =
        error?.status === 409
          ? 'Không thể xóa khách đang có trạng thái điểm danh. Hãy bỏ tick điểm danh trước khi xóa khỏi bảng.'
          : error?.message || 'Không thể xóa khách khỏi bảng điểm danh';

      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const removeExtraPassenger = (passengerId: number) => {
    setExtraPassengers((prev) => prev.filter((passenger) => passenger.id !== passengerId));
  };

  const handleConfirmAllExtraPassengers = async () => {
    if (extraPassengers.length === 0 || !selectedTripId) return;

    if (extraPassengerRoundConfirmed) {
      enqueueSnackbar('Chặng đã xác nhận hoàn tất, không thể thêm khách ngoài biên chế.', { variant: 'warning' });
      return;
    }

    try {
      const savePromises = extraPassengers.flatMap((passenger) =>
        selectedRoundIds.map((roundId) =>
          api.createTransaction({
            passengerId: passenger.id,
            roundId,
            busId: passenger.busId!,
            checkIn: false,
            checkOut: false,
            checkInNote: null,
            checkOutNote: null,
          })
        )
      );

      await Promise.all(savePromises);
      enqueueSnackbar('Đã thêm khách ngoài biên chế vào bảng', { variant: 'success' });
      await Promise.all([refetchTransactions(), refetchPassengers()]);
      setExtraPassengers([]);
      setShowAddPassengerPanel(false);
    } catch (error: any) {
      const conflictMessage =
        error?.status === 409 && typeof error?.message === 'string'
          ? error.message.split(' - ').pop()
          : null;

      enqueueSnackbar(
        conflictMessage || error?.message || 'Có lỗi xảy ra khi thêm khách ngoài biên chế',
        { variant: 'error' }
      );
    }
  };

  return {
    showAddPassengerPanel,
    setShowAddPassengerPanel,
    extraPassengers,
    extraPassengerRoundConfirmed,
    addExtraPassenger,
    removeExtraPassenger,
    handleConfirmAllExtraPassengers,
    handleRemovePassengerFromTransaction,
    canRemovePassenger,
  };
};
