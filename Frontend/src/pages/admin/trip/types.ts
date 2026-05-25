export type TripStatus = 'DOING' | 'DONE';

export type TripRow = {
  id?: number;
  localId: string;
  name: string;
  status: TripStatus;
  busCount: number;
  roundCount: number;
  completedRoundCount: number;
  isEdited?: boolean;
};
