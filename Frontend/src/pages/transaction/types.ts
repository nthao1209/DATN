export type PassengerRow = {
  id: number;
  name: string;
  tel: string;
  busId: number | null;
  busName: string;
  assignedBusName?: string;
};

export type TripOption = {
  id: number;
  name: string;
};

export type BusOption = {
  id: number;
  busCode?: string;
  registrationNumber?: string;
};

export type RoundOption = {
  id: number;
  name?: string;
};

export type DraftCell = {
  transactionId?: number;
  passengerId: number;
  roundId: number;
  busId: number;
  checkIn: boolean;
  checkOut: boolean;
  checkInNote: string;
  checkOutNote: string;
  checkInAt?: Date | string | null;
  checkOutAt?: Date | string | null;
  checkInBy?: number | null;
  checkOutBy?: number | null;
  dirty?: boolean;
};

export type TransactionRecord = {
  id: number;
  passengerId?: number;
  roundId?: number;
  busId?: number;
  checkIn?: boolean;
  checkOut?: boolean;
  checkInAt?: string | Date | null;
  checkOutAt?: string | Date | null;
  checkInBy?: number | null;
  checkOutBy?: number | null;
  checkInNote?: string | null;
  checkOutNote?: string | null;
  passenger?: {
    id?: number;
    name?: string;
    tel?: string;
    busId?: number;
    bus?: {
      id?: number;
      busCode?: string;
      registrationNumber?: string;
    };
  };
  round?: {
    id?: number;
    tripId?: number;
    name?: string;
  };
  bus?: {
    id?: number;
    busCode?: string;
    registrationNumber?: string;
  };
};

export type TransactionTableRow = PassengerRow & {
  isSummary?: boolean;
};

export type RoundSummary = Record<number, { checkIn: number; checkOut: number; total: number }>;

export const keyOf = (passengerId: number, roundId: number) => `${passengerId}_${roundId}`;
