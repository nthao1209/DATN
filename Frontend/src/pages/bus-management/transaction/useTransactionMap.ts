import { useMemo } from 'react';
import { getResolvedAttendanceState } from '../../../utils/attendanceStats';
import type { DraftCell, TransactionRecord } from './types';
import { keyOf } from './types';

export const useTransactionMap = (transactions: TransactionRecord[]) => {
  return useMemo(() => {
    const map: Record<string, DraftCell> = {};

    transactions.forEach((tx) => {
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const roundId = Number(tx.roundId ?? tx.round?.id ?? 0);
      const busId = Number(tx.busId ?? tx.bus?.id ?? 0);
      if (!passengerId || !roundId || !busId) return;

      const { checkIn, checkOut, checkInBusId, checkOutBusId, checkInNote, checkOutNote } =
        getResolvedAttendanceState(tx);

      map[keyOf(passengerId, roundId)] = {
        transactionId: Number(tx.id),
        passengerId,
        roundId,
        busId,
        checkIn,
        checkOut,
        checkInNote,
        checkOutNote,
        checkInBusId: checkInBusId ?? busId,
        checkOutBusId: checkOutBusId ?? busId,
      };
    });

    return map;
  }, [transactions]);
};
