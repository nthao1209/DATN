export type PassengerRow = {
  id?: number;
  localId: string;
  name: string;
  tel: string;
  note: string;
  tripId: number | null;
  busId: number | null;
  busCode?: string;
  isEdited?: boolean;
};

export type PassengerTrip = {
  id: number;
  name: string;
};

export type PassengerBus = {
  id: number;
  busCode: string;
  registrationNumber?: string;
};

export type BusesByTrip = Record<number, PassengerBus[]>;
