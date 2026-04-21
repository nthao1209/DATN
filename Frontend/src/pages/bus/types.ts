export type BusManager = {
  id: number;
  name: string;
  description?: string | null;
};

export type BusRow = {
  id?: number;
  localId: string;
  busCode: string;
  registrationNumber: string;
  driverName: string;
  driverTel: string;
  tourGuideName: string;
  tourGuideTel: string;
  description: string;
  managerId: number | null;
  managerName: string;
  isEdited?: boolean;
};
