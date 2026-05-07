export type RoundStatus = 'DOING' | 'DONE';

export type RoundRow = {
  id?: number;
  localId: string;
  name: string;
  time: string;
  status: RoundStatus;
  transactionCount: number;
  checkInCount?: number;
  checkOutCount?: number;
  passengerCount: number;
  isEdited?: boolean;
};
