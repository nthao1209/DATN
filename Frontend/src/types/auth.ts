export interface User {
  id: number;
  email:string;
  name: string;
  firebaseUid: string;
}
export interface Tenant {
  id: number;
  name: string;
  joinCode?: string;
  role?: string;
}
export interface AuthState{
  user: User | null;
  token: string | null;
  hasTenant: boolean;
  loading: boolean;
  error: string | null;
  statusMessage: string | null;
  currentTenant: Tenant | null;
  tenants: Tenant[];
}

