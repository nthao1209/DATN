import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, Tenant, User } from '../../types/auth';

const initialState: AuthState = {
  user: null,
  token: null,
  hasTenant: false,
  loading: false,
  error: null,
  statusMessage: null,
  needsEmailVerification: false,
  currentTenant:null,
  tenants: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginRequest: (state,_action) => {state.loading=true},
    registerRequest: (state,_action: PayloadAction<any>) => { state.loading = true; },
    forgotPasswordRequest: (state, _action: PayloadAction<string>) => { state.loading = true; },
    authSuccess: (state, action:PayloadAction<{user: User,token:string, tenants: Tenant[], roleId?: number}>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.tenants = action.payload.tenants || [];
      state.hasTenant = state.tenants.length > 0;
      state.currentTenant = state.tenants[0] || null;
      state.roleId = action.payload.roleId || state.currentTenant?.roleId || state.currentTenant?.role?.id;
      state.needsEmailVerification = false;
      state.statusMessage = null;
      if (state.currentTenant?.id) {
        localStorage.setItem('currentTenantId', String(state.currentTenant.id));
      } else {
        localStorage.removeItem('currentTenantId');
      }
      state.loading = false;
      state.error = null;
    },
    registerSuccess: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.user = null;
      state.token = null;
      state.hasTenant = false;
      state.currentTenant = null;
      state.tenants = [];
      state.roleId = undefined;
      state.statusMessage = action.payload;
      state.needsEmailVerification = true;
      state.error = null;
      localStorage.removeItem('currentTenantId');
    },
    emailVerificationRequired: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.user = null;
      state.token = null;
      state.hasTenant = false;
      state.currentTenant = null;
      state.tenants = [];
      state.roleId = undefined;
      state.statusMessage = action.payload;
      state.needsEmailVerification = true;
      state.error = null;
      localStorage.removeItem('currentTenantId');
    },
    joinTenantSuccess: (state, action: PayloadAction<Tenant>) => {
      const tenant = action.payload;
      state.currentTenant = tenant;
      state.roleId = tenant.roleId || tenant.role?.id;
      state.tenants = state.tenants.some((t) => t.id === tenant.id)
        ? state.tenants.map((t) => (t.id === tenant.id ? { ...t, ...tenant } : t))
        : [...state.tenants, tenant];
      state.hasTenant = true;
      state.loading = false;
      localStorage.setItem('currentTenantId', String(tenant.id));
    },
    authFailure: (state, action: PayloadAction<string>) =>{
      state.loading = false;
      state.error = action.payload;
    },
    joinTenantRequest: (state, _action: PayloadAction<string>) => {
       state.loading = true;
       state.error = null;
    },
    setCurrentTenant: (state, action: PayloadAction<Tenant>) => {
      state.currentTenant = action.payload;
      state.hasTenant = true; // Chắc chắn là true khi đã chọn
      state.roleId = action.payload.roleId || action.payload.role?.id;
      localStorage.setItem('currentTenantId', String(action.payload.id));
    },
    logout: (state) =>{
      state.user = null;
      state.token = null;
      state.currentTenant = null;
      state.tenants = [];
      state.hasTenant = false;
      state.roleId = undefined;
      state.needsEmailVerification = false;
      state.statusMessage = null;
      state.error = null;
      localStorage.removeItem('currentTenantId');
    },
    clearMessages: (state) => {
      state.error = null;
      state.statusMessage = null;
    }
  }
});

export const { loginRequest, registerRequest, registerSuccess, emailVerificationRequired, authSuccess, authFailure, logout, forgotPasswordRequest, joinTenantSuccess, joinTenantRequest, setCurrentTenant } = authSlice.actions;
export default authSlice.reducer;
