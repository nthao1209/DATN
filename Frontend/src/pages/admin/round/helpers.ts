import type { RoundRow } from './types';
import { getResolvedAttendanceState } from '../../../utils/attendanceStats';

const MIN_ROUND_ROWS = 1;

export const makeRoundLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const isSameRoundRow = (current: RoundRow, initial: RoundRow) => {
  return (
    current.name.trim() === initial.name.trim() &&
    current.time.trim() === initial.time.trim() &&
    current.status === initial.status
  );
};

export const isNewRoundRowDirty = (row: RoundRow) => {
  return Boolean(row.name.trim() || row.time.trim() || row.status !== 'DOING');
};

export const buildRoundRows = ({
  rounds,
  transactions,
  lockStatuses,
  buses,
}: {
  rounds: any[];
  transactions: any[];
  lockStatuses: any[];
  buses: any[];
}) => {
  const mapped: RoundRow[] = rounds.map((round: any) => {
    const roundId = Number(round.id);
    const checkInTxCount = transactions.filter(
      (tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === roundId && getResolvedAttendanceState(tx).checkIn
    ).length;
    const checkOutTxCount = transactions.filter(
      (tx: any) => Number(tx.roundId ?? tx.round?.id ?? 0) === roundId && getResolvedAttendanceState(tx).checkOut
    ).length;
    const lockedInCount = lockStatuses.filter(
      (status: any) => Number(status.roundId) === roundId && Boolean(status.checkInLocked)
    ).length;
    const lockedOutCount = lockStatuses.filter(
      (status: any) => Number(status.roundId) === roundId && Boolean(status.checkOutLocked)
    ).length;
    const busCount = Number(round?.busCount ?? buses.length ?? 0);
    const completedBusCount = Number(round?.completedBusCount ?? 0);

    return {
      id: roundId,
      localId: `db_${round.id}`,
      name: round.name || '',
      time: round.time || '',
      status: round.status === 'DONE' ? 'DONE' : 'DOING',
      transactionCount: Number(checkInTxCount),
      checkInCount: Number(checkInTxCount),
      checkOutCount: Number(checkOutTxCount),
      passengerCount: Number(round?.passengerCount || 0),
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

  const rows = [...mapped];
  while (rows.length < MIN_ROUND_ROWS) {
    rows.push({
      localId: makeRoundLocalId(),
      name: '',
      time: '',
      status: 'DOING',
      transactionCount: 0,
      passengerCount: 0,
      busCount: buses.length,
      completedBusCount: 0,
    });
  }

  return { rows, initialById };
};
