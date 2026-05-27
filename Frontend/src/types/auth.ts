export interface User {
  id: number;
  email: string;
  name: string;
  firebaseUid: string;
  isDisabled?: boolean;
  disabledAt?: string | null;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface Tenant {
  id: number;
  name: string;
  joinCode?: string;
  role?: Role;
  roleId?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  hasTenant: boolean;
  loading: boolean;
  error: string | null;
  statusMessage: string | null;
  needsEmailVerification: boolean;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  roleId?: number;
}

