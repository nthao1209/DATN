import { useMemo } from 'react';
import type { DraftCell, TransactionRecord } from './types';
import { keyOf } from './types';

export const useTransactionMap = (transactions: TransactionRecord[]) => {
  // Chuyển danh sách transaction thành map passengerId_roundId để tra cứu ô nhanh trong bảng.
  return useMemo(() => {
    const map: Record<string, DraftCell> = {};
    // Nếu transaction có nhiều event, lấy event mới nhất để phản ánh trạng thái thực tế sau cùng.
    const getLatestAttendanceEvent = (tx: TransactionRecord, actions: string[]) => {
      return [...(tx.events || [])]
        .filter((item) => item.action && actions.includes(item.action))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];
    };

    transactions.forEach((tx) => {
      // Chuẩn hóa id từ nhiều dạng response khác nhau: field phẳng hoặc object lồng nhau.
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const roundId = Number(tx.roundId ?? tx.round?.id ?? 0);
      const busId = Number(tx.busId ?? tx.bus?.id ?? 0);
      if (!passengerId || !roundId || !busId) return;

      // Ưu tiên trạng thái từ event mới nhất; nếu chưa có event thì dùng field chính của transaction.
      const checkInEvent = getLatestAttendanceEvent(tx, ['CHECK_IN_ON', 'CHECK_IN_OFF']);
      const checkOutEvent = getLatestAttendanceEvent(tx, ['CHECK_OUT_ON', 'CHECK_OUT_OFF']);
      const checkIn = checkInEvent ? checkInEvent.action === 'CHECK_IN_ON' : Boolean(tx.checkIn);
      const checkOut = checkOutEvent ? checkOutEvent.action === 'CHECK_OUT_ON' : Boolean(tx.checkOut);
      const checkInBusId = Number(checkInEvent?.busId ?? tx.checkInBusId ?? busId);
      const checkOutBusId = Number(checkOutEvent?.busId ?? tx.checkOutBusId ?? busId);
      const checkInNote = checkInEvent?.note ?? tx.checkInNote ?? '';
      const checkOutNote = checkOutEvent?.note ?? tx.checkOutNote ?? '';

      map[keyOf(passengerId, roundId)] = {
        transactionId: Number(tx.id),
        passengerId,
        roundId,
        busId,
        checkIn,
        checkOut,
        checkInNote,
        checkOutNote,
        checkInBusId,
        checkOutBusId,
      };
    });

    return map;
  }, [transactions]);
};
