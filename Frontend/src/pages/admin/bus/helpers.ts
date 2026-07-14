import type { TransactionRecord } from '../../bus-management/transaction/types';
import { getLatestAttendanceEvent, getResolvedAttendanceState } from '../../../utils/attendanceStats';
import type { BusRow } from './types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

type WrongBusPassengerSummary = {
  transactionId: number;
  passengerId: number;
  passengerName: string;
  assignedBusId: number;
  assignedBusLabel: string;
  actualBusId: number;
  actualBusLabel: string;
  checkInWrongBusId?: number | null;
  checkInWrongBusLabel?: string;
  checkOutWrongBusId?: number | null;
  checkOutWrongBusLabel?: string;
  roundName: string;
  lastEventTime: number;
};

// Lấy xe gốc của hành khách. Khi điểm danh sai xe, Transaction vẫn lưu xe gốc,
// còn xe thực tế sẽ nằm trong AttendanceEvent.
const getAssignedBusId = (tx: TransactionRecord) =>
  Number(tx.passenger?.busId ?? tx.busId ?? tx.bus?.id ?? 0) || null;

const getEventTime = (event?: { createdAt?: string | Date | null }) =>
  event?.createdAt ? new Date(event.createdAt).getTime() : 0;

const getWrongBusCandidates = (tx: TransactionRecord, assignedBusId: number) => {
  const state = getResolvedAttendanceState(tx);
  const checkInEvent = getLatestAttendanceEvent(tx, ['CHECK_IN_ON', 'CHECK_IN_OFF']);
  const checkOutEvent = getLatestAttendanceEvent(tx, ['CHECK_OUT_ON', 'CHECK_OUT_OFF']);
  const candidates: Array<{ busId: number; time: number; type: 'check_in' | 'check_out' }> = [];

  // Trạng thái đã resolve cho biết lượt check-in gần nhất đang được ghi nhận ở xe nào.
  // Nếu xe đó khác xe gốc thì đây là một trường hợp check-in sai xe.
  if (state.checkInBusId && Number(state.checkInBusId) !== assignedBusId) {
    candidates.push({
      busId: Number(state.checkInBusId),
      time: getEventTime(checkInEvent),
      type: 'check_in',
    });
  }

  // Tương tự check-in, nhưng áp dụng cho lượt check-out để phân biệt sai xe theo từng chiều.
  if (state.checkOutBusId && Number(state.checkOutBusId) !== assignedBusId) {
    candidates.push({
      busId: Number(state.checkOutBusId),
      time: getEventTime(checkOutEvent),
      type: 'check_out',
    });
  }

  // Duyệt thêm lịch sử event để không bỏ sót các thao tác ON từng xảy ra ở xe khác.
  // Cách này giúp trưởng đoàn vẫn thấy khách từng bị điểm danh sai xe dù trạng thái đã đổi sau đó.
  (tx.events || []).forEach((event) => {
    const eventBusId = Number(event.busId || 0);

    if (
      !eventBusId ||
      eventBusId === assignedBusId ||
      (event.action !== 'CHECK_IN_ON' && event.action !== 'CHECK_OUT_ON')
    ) {
      return;
    }

    candidates.push({
      busId: eventBusId,
      time: getEventTime(event),
      type: event.action === 'CHECK_IN_ON' ? 'check_in' : 'check_out',
    });
  });

  // Đưa event mới nhất lên đầu để modal hiển thị xe thực tế gần nhất của khách.
  return candidates.sort((left, right) => right.time - left.time);
};

const getBusLabel = (
  busId: number,
  busLabelById: Map<number, string>,
  fallback?: string
) => busLabelById.get(busId) || fallback || `Xe #${busId}`;

const buildWrongBusPassengersForAssignedBus = (
  busId: number,
  tripTransactions: TransactionRecord[],
  busLabelById: Map<number, string>
) => {
  // Map theo hành khách để một khách sai xe nhiều lần vẫn chỉ hiện một dòng tổng hợp.
  const passengerMap = new Map<number | string, WrongBusPassengerSummary>();

  tripTransactions.forEach((tx) => {
    const assignedBusId = getAssignedBusId(tx);

    // Sai xe phải được tổng hợp ở xe gốc của khách, không tổng hợp ở xe thực tế.
    // Ví dụ khách xe 1 ngồi xe 2 thì số "Sai xe" nằm ở dòng xe 1.
    if (assignedBusId !== busId) return;

    const actualBus = getWrongBusCandidates(tx, assignedBusId)[0];

    if (!actualBus) return;

    const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
    const mapKey = passengerId || `${tx.id}_${actualBus.busId}`;
    const current = passengerMap.get(mapKey);

    // Nếu đã có bản ghi mới hơn của cùng hành khách thì giữ bản mới nhất.
    if (current && current.lastEventTime > actualBus.time) return;

    const candidates = getWrongBusCandidates(tx, assignedBusId);
    const checkInWrongBus = candidates.find((candidate) => candidate.type === 'check_in');
    const checkOutWrongBus = candidates.find((candidate) => candidate.type === 'check_out');

    passengerMap.set(mapKey, {
      transactionId: tx.id,
      passengerId,
      passengerName: tx.passenger?.name || `Khách #${passengerId || tx.id}`,
      assignedBusId,
      assignedBusLabel: getBusLabel(assignedBusId, busLabelById, tx.bus?.busCode),
      actualBusId: actualBus.busId,
      actualBusLabel: getBusLabel(actualBus.busId, busLabelById),
      checkInWrongBusId: checkInWrongBus?.busId ?? null,
      checkInWrongBusLabel: checkInWrongBus
        ? getBusLabel(checkInWrongBus.busId, busLabelById)
        : undefined,
      checkOutWrongBusId: checkOutWrongBus?.busId ?? null,
      checkOutWrongBusLabel: checkOutWrongBus
        ? getBusLabel(checkOutWrongBus.busId, busLabelById)
        : undefined,
      roundName: tx.round?.name || '',
      lastEventTime: actualBus.time,
    });
  });

  return Array.from(passengerMap.values()).map(({ lastEventTime: _lastEventTime, ...item }) => item);
};

export const isSameBusRow = (current: BusRow, initial: BusRow) => (
  current.busCode.trim() === initial.busCode.trim() &&
  current.registrationNumber.trim() === initial.registrationNumber.trim() &&
  current.driverName.trim() === initial.driverName.trim() &&
  current.driverTel.trim() === initial.driverTel.trim() &&
  current.tourGuideName.trim() === initial.tourGuideName.trim() &&
  current.tourGuideTel.trim() === initial.tourGuideTel.trim() &&
  current.description.trim() === initial.description.trim() &&
  (current.managerId ?? null) === (initial.managerId ?? null)
);

export const isNewBusRowDirty = (row: BusRow) => Boolean(
  row.busCode.trim() ||
  row.registrationNumber.trim() ||
  row.driverName.trim() ||
  row.driverTel.trim() ||
  row.tourGuideName.trim() ||
  row.tourGuideTel.trim() ||
  row.description.trim() ||
  row.managerId
);

export const createEmptyBusRow = (): BusRow => ({
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

export const buildBusRows = (buses: any[]) => {
  const mapped: BusRow[] = buses.map((bus: any) => ({
    id: Number(bus.id),
    localId: `db_${bus.id}`,
    busCode: bus.busCode || '',
    registrationNumber: bus.registrationNumber || '',
    driverName: bus.driverName || '',
    driverTel: bus.driverTel || '',
    tourGuideName: bus.tourGuideName || '',
    tourGuideTel: bus.tourGuideTel || '',
    description: bus.description || '',
    managerId: bus.managerId ? Number(bus.managerId) : null,
    managerName: bus.manager?.name || '',
  }));

  const initialById: Record<number, BusRow> = {};
  mapped.forEach((row) => {
    if (row.id) initialById[row.id] = row;
  });

  const rows = [...mapped];
  while (rows.length < MIN_ROWS) rows.push(createEmptyBusRow());

  return { rows, initialById };
};

export const buildBusAttendanceSummary = ({
  rows,
  tripId,
  roundId,
  transactions,
}: {
  rows: BusRow[];
  tripId?: string;
  roundId?: number | null;
  transactions: TransactionRecord[];
}) => {
  if (!tripId) return [];

  const currentTripId = Number(tripId);
  const busLabelById = new Map<number, string>();

  // Tạo map id xe -> tên hiển thị để modal có thể ghi rõ xe gốc và xe thực tế.
  rows.forEach((row) => {
    if (!row.id) return;
    busLabelById.set(
      Number(row.id),
      row.busCode || row.registrationNumber || `Xe #${row.id}`
    );
  });

  // Chỉ lấy transaction thuộc chuyến hiện tại để không lẫn dữ liệu giữa các chuyến.
  const tripTransactions = transactions.filter((tx) => {
    const txTripId = Number(tx.round?.tripId ?? (tx as any)?.bus?.tripId ?? 0);
    const txRoundId = Number(tx.roundId ?? tx.round?.id ?? 0);

    return txTripId === currentTripId && (!roundId || txRoundId === roundId);
  });

  return rows
    .filter((row) => row.id)
    .map((bus) => {
      const busId = Number(bus.id);

      // Một dòng xe được đưa vào thống kê nếu khách thuộc xe đó,
      // hoặc có event check-in/check-out thực tế phát sinh trên xe đó.
      const busTransactions = tripTransactions.filter((tx) => {
        const state = getResolvedAttendanceState(tx);
        return (
          Number(tx.busId ?? tx.bus?.id ?? 0) === busId ||
          Number(state.checkInBusId ?? 0) === busId ||
          Number(state.checkOutBusId ?? 0) === busId
        );
      });

      return {
        busId,
        busLabel: bus.busCode || bus.registrationNumber || `Xe #${bus.id}`,
        // Hiện tại số check-in/check-out đang đếm theo xe thực tế của event.
        // Vì vậy khách xe 1 check-in trên xe 2 sẽ làm tăng số check-in của xe 2.
        checkInCount: busTransactions.filter((tx) => {
          const state = getResolvedAttendanceState(tx);
          return state.checkIn && Number(state.checkInBusId ?? tx.busId ?? tx.bus?.id ?? 0) === busId;
        }).length,
        checkOutCount: busTransactions.filter((tx) => {
          const state = getResolvedAttendanceState(tx);
          return state.checkOut && Number(state.checkOutBusId ?? tx.busId ?? tx.bus?.id ?? 0) === busId;
        }).length,
        totalTransactions: busTransactions.length,
        wrongBusPassengers: buildWrongBusPassengersForAssignedBus(
          busId,
          tripTransactions,
          busLabelById
        ),
      };
    });
};
