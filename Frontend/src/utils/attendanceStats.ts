type AttendanceEventLike = {
  action?: string;
  busId?: number | string | null;
  note?: string | null;
  createdAt?: string | Date | null;
};

type TransactionLike = {
  checkIn?: boolean;
  checkOut?: boolean;
  busId?: number | string | null;
  checkInBusId?: number | string | null;
  checkOutBusId?: number | string | null;
  checkInNote?: string | null;
  checkOutNote?: string | null;
  events?: AttendanceEventLike[];
};

const getEventTime = (event: AttendanceEventLike) =>
  event.createdAt ? new Date(event.createdAt).getTime() : 0;

export const getLatestAttendanceEvent = (
  tx: TransactionLike,
  actions: string[]
) =>
  // Lấy event mới nhất theo nhóm action để frontend ưu tiên lịch sử thực tế hơn field tổng hợp.
  [...(tx.events || [])]
    .filter((event) => Boolean(event.action) && actions.includes(String(event.action)))
    .sort((a, b) => getEventTime(b) - getEventTime(a))[0];

export const getResolvedAttendanceState = (tx: TransactionLike) => {
  // Transaction lưu trạng thái tổng hợp, còn AttendanceEvent lưu lịch sử thao tác.
  // Khi có event, frontend dùng event mới nhất để xác định trạng thái đúng tại thời điểm hiện tại.
  const checkInEvent = getLatestAttendanceEvent(tx, ['CHECK_IN_ON', 'CHECK_IN_OFF']);
  const checkOutEvent = getLatestAttendanceEvent(tx, ['CHECK_OUT_ON', 'CHECK_OUT_OFF']);
  const fallbackBusId = Number(tx.busId ?? 0) || null;

  return {
    // Event *_ON nghĩa là đang được tick; event *_OFF nghĩa là đã bỏ tick.
    checkIn: checkInEvent ? checkInEvent.action === 'CHECK_IN_ON' : Boolean(tx.checkIn),
    checkOut: checkOutEvent ? checkOutEvent.action === 'CHECK_OUT_ON' : Boolean(tx.checkOut),
    // busId trong event là xe thực tế phát sinh thao tác, dùng để phát hiện sai xe.
    checkInBusId: Number(checkInEvent?.busId ?? tx.checkInBusId ?? fallbackBusId) || null,
    checkOutBusId: Number(checkOutEvent?.busId ?? tx.checkOutBusId ?? fallbackBusId) || null,
    checkInNote: tx.checkInNote ?? checkInEvent?.note ?? '',
    checkOutNote: tx.checkOutNote ?? checkOutEvent?.note ?? '',
  };
};
