export interface User {
  id: string;
  name: string;
  description?: string | null;
}

export interface Bus {
  id?: string;
  tripId?: string;
  busCode: string;
  registrationNumber: string;
  driverName: string;
  driverTel: string;
  tourGuideName: string;
  tourGuideTel: string;
  description?: string;
  managerId?: number;
  manager?: User | null;
}
