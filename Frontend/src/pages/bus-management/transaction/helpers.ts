import type { DraftCell } from './types';

export const areNumberArraysEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => Number(value) === Number(right[index]));
};

export const normalizeNote = (note?: string | null) => (note ?? '').trim();

// So sánh draft trên màn với dữ liệu gốc để biết ô này có thật sự cần lưu hay không.
export const isSameCell = (current: DraftCell, base?: DraftCell) => {
  const checkInNoteMatches =
    !current.checkInNoteTouched || normalizeNote(current.checkInNote) === normalizeNote(base?.checkInNote);
  const checkOutNoteMatches =
    !current.checkOutNoteTouched || normalizeNote(current.checkOutNote) === normalizeNote(base?.checkOutNote);
  const checkInBusMatches =
    !current.checkIn ||
    Number(current.checkInBusId ?? current.busId) ===
      Number(base?.checkInBusId ?? base?.busId ?? current.checkInBusId ?? current.busId);
  const checkOutBusMatches =
    !current.checkOut ||
    Number(current.checkOutBusId ?? current.busId) ===
      Number(base?.checkOutBusId ?? base?.busId ?? current.checkOutBusId ?? current.busId);

  if (!base) {
    return (
      current.checkIn === false &&
      current.checkOut === false &&
      checkInNoteMatches &&
      checkOutNoteMatches
    );
  }

  return (
    current.checkIn === Boolean(base.checkIn) &&
    current.checkOut === Boolean(base.checkOut) &&
    checkInNoteMatches &&
    checkOutNoteMatches &&
    checkInBusMatches &&
    checkOutBusMatches
  );
};

// Tạo message cảnh báo đúng theo phần bị khóa: lượt đi, lượt về hoặc cả hai.
export const buildLockedAttendanceMessage = (params: {
  lockedIn: boolean;
  lockedOut: boolean;
  changingCheckIn: boolean;
  changingCheckInNote: boolean;
  changingCheckOut: boolean;
  changingCheckOutNote: boolean;
}) => {
  const messages: string[] = [];

  if (params.lockedIn && (params.changingCheckIn || params.changingCheckInNote)) {
    messages.push('Lượt đi đã khóa nên không sửa được check-in/ghi chú.');
  }

  if (params.lockedOut && (params.changingCheckOut || params.changingCheckOutNote)) {
    messages.push('Lượt về đã khóa nên không sửa được check-out/ghi chú.');
  }

  return messages.length ? messages.join(' ') : 'Lượt đã bị khóa, không thể chỉnh sửa.';
};
