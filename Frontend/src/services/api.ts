import axios from 'axios';
import { auth as fbAuth } from '../config/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { PassengerImportPreviewResponse } from '../pages/admin/passenger/types';


const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const normalizedApiBaseUrl = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '') + '/api'
  : '/api';

const axiosClient = axios.create({
  baseURL: normalizedApiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_ENDPOINT_HINTS = [
  '/auth/sync',
  '/auth/status',
  '/auth/delete-account',
  '/tenants/create',
  '/tenants/join',
];

const isAuthRelatedEndpoint = (url?: string) =>
  !!url && AUTH_ENDPOINT_HINTS.some((hint) => url.includes(hint));

let authInitPromise: Promise<User | null> | null = null;

const waitForAuthInit = (): Promise<User | null> => {
  if (fbAuth.currentUser) return Promise.resolve(fbAuth.currentUser);
  if (authInitPromise) return authInitPromise;

  authInitPromise = new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(fbAuth, (user) => {
      unsubscribe();
      resolve(user);
      authInitPromise = null;
    });
  });

  return authInitPromise;
};

axiosClient.interceptors.request.use(async (config: any) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  const existingAuthorization = config.headers?.Authorization || config.headers?.authorization;
  if (existingAuthorization) {
    return config;
  }

  const user = fbAuth.currentUser ?? (await waitForAuthInit());
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config as any;
    const isUnauthorized = error.response?.status === 401;
    const requestUrl = String(originalRequest?.url || '');

    if (isUnauthorized && !originalRequest?._retry && originalRequest && !isAuthRelatedEndpoint(requestUrl)) {
      originalRequest._retry = true;
      const user = fbAuth.currentUser ?? (await waitForAuthInit());
      if (user) {
        const freshToken = await user.getIdToken(true);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return axiosClient(originalRequest);
      }
    }

    const method = String(originalRequest?.method || 'GET').toUpperCase();
    const base = String(originalRequest?.baseURL || axiosClient.defaults.baseURL || '');
    const path = String(originalRequest?.url || 'unknown-endpoint');
    const endpoint = path.startsWith('http') ? path : `${base}${path}`;
    const status = error.response?.status;
    const responseData = error.response?.data;
    const backendMessage =
      responseData?.detail ||
      responseData?.message ||
      (typeof responseData === 'string' ? responseData : '');

    let message = '';

    if (error.code === 'ECONNABORTED') {
      message = `Timeout khi gọi API ${method} ${endpoint}. Vui lòng kiểm tra server hoặc mạng.`;
    } else if (!error.response) {
      message = `Không thể kết nối server tại ${endpoint}. Lỗi mạng: ${error.message || 'Unknown network error'}`;
    } else {
      message = `[${status}] ${method} ${endpoint} - ${backendMessage || 'Server không trả về chi tiết lỗi'}`;
    }

    const apiError = new Error(message) as Error & {
      status?: number;
      endpoint?: string;
      code?: string;
    };
    apiError.status = status;
    apiError.endpoint = endpoint;
    apiError.code = error.code;

    return Promise.reject(apiError);
  }
);

/**
 * TẤT CẢ API CỦA HỆ THỐNG
 */
export const api = {
  get: <T = any>(url: string) => axiosClient.get<T, T>(url),
  post: <T = any>(url: string, data?: any) => axiosClient.post<T, T>(url, data),
  put: <T = any>(url: string, data?: any) => axiosClient.put<T, T>(url, data),
  delete: <T = any>(url: string) => axiosClient.delete<T, T>(url),

  // Auth & Sync
  syncUser: (data: { email: string; name: string; firebaseUid: string }, token?: string) => 
    axiosClient.post('/auth/sync', data, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),

  getMyStatus: async (token?: string, options?: { silentOn401?: boolean }) => {
    try {
      const resolvedToken = token || (fbAuth.currentUser ? await fbAuth.currentUser.getIdToken(true) : undefined);

      if (!resolvedToken) {
        return null;
      }

      return await axiosClient.get(
        '/auth/status',
        resolvedToken ? { headers: { Authorization: `Bearer ${resolvedToken}` } } : undefined
      );
    } catch (error: any) {
      if (options?.silentOn401 && error?.status === 401) {
        return null;
      }

      throw error;
    }
  }, // Trả về { user, tenants: [] }

  joinTenant: (joinCode: string) => 
    axiosClient.post('/tenants/join', { joinCode }),

  deleteAccount: () => 
    axiosClient.delete('/auth/delete-account'),

  // Tenant APIs
  createTenant: (data: { name: string }) =>
    axiosClient.post('/tenants/create', data),

  getTenant: (id: string) =>
    axiosClient.get(`/tenants/${id}`),

  // Trip APIs
  getTrips: () =>
    axiosClient.get<any[], any[]>('/trips'),

  createTrip: (data: any) =>
    axiosClient.post('/trips', data),

  updateTrip: (id: string, data: any) =>
    axiosClient.put(`/trips/${id}`, data),

  deleteTrip: (id: string) =>
    axiosClient.delete(`/trips/${id}`),

  // Bus APIs
  getBuses: (tripId: string) =>{
      if (!tripId) throw new Error('tripId is required');
      return axiosClient.get<any[], any[]>(`/trips/${tripId}/buses`);
  },

  createBus: (tripId: string, data: any) =>
    axiosClient.post(`/trips/${tripId}/buses`, data),

  updateBus: (id: string, data: any) =>
    axiosClient.put(`/buses/${id}`, data),

  deleteBus: (id: string) =>
    axiosClient.delete(`/buses/${id}`),

  getBusManagers: () =>
    axiosClient.get<any[], any[]>('/busManagers'),

  // Round APIs
  getRounds: (tripId: string) => {
    if (!tripId) throw new Error('tripId is required');
    return axiosClient.get<any[], any[]>(`/trips/${tripId}/rounds`);
  },

  createRound: (tripId: string, data: any) => {
    if (!tripId) throw new Error('tripId is required');
    return axiosClient.post(`/trips/${tripId}/rounds`, data);
  },

  updateRound: (id: string, data: any) =>
    axiosClient.put(`/rounds/${id}`, data),

  deleteRound: (id: string) =>
    axiosClient.delete(`/rounds/${id}`),

  // Passenger APIs
  getPassengers: (tripId?: string, busId?: string) =>
    axiosClient.get<any[], any[]>(
      busId
        ? `/trips/${tripId}/passengers?busId=${busId}`
        : `/trips/${tripId}/passengers`
    ),

  getAttendancePassengers: (tripId: string) =>
    axiosClient.get<any[], any[]>(`/trips/${tripId}/passengers?scope=attendance`),

  searchPassengersByNameForAttendance: (tripId: string, keyword: string) =>
    axiosClient.get<any[], any[]>(
      `/trips/${tripId}/passengers?scope=attendance&keyword=${encodeURIComponent(keyword)}`
    ),

  createPassenger: (tripId: string, data: any) =>
    axiosClient.post(`/trips/${tripId}/passengers`, data),

  updatePassenger: (id: string, data: any) =>
    axiosClient.put(`/passengers/${id}`, data),

  deletePassenger: (id: string) =>
    axiosClient.delete(`/passengers/${id}`),

  getPassengerImportSheets: async (
      tripId: string,
      file: File
    ) => {
      const formData = new FormData();

      formData.append('file', file);

      return axiosClient.post<
        { sheetNames: string[] },
        { sheetNames: string[] }
      >(
        `/trips/${tripId}/passengers/import-sheets`,
        formData
      );
    },

    importPassengersPreview: (tripId: string, file: File, sheetName: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sheetName', sheetName);

      return axiosClient.post<PassengerImportPreviewResponse, PassengerImportPreviewResponse>(
        `/trips/${tripId}/passengers/import-preview`,
        formData
      );
  },

  // User APIs
  getUsers: () =>
    axiosClient.get<any[], any[]>('/users'),

  createUser: (data: any) =>
    axiosClient.post('/users', data),

  updateUser: (id: string, data: any) =>
    axiosClient.put(`/users/${id}`, data),

  deleteUser: (id: string) =>
    axiosClient.delete(`/users/${id}`),
  
  setUserStatus: (id: string, isDisabled: boolean) =>
    axiosClient.patch(`/users/${id}/status`, { isDisabled }),

  // Role APIs
  getRoles: () =>
    axiosClient.get<any[], any[]>('/roles'),

  createRole: (data: any) =>
    axiosClient.post('/roles', data),

  updateRole: (id: string, data: any) =>
    axiosClient.put(`/roles/${id}`, data),

  deleteRole: (id: string) =>
    axiosClient.delete(`/roles/${id}`),

  // Transaction APIs
  getTransactions: () =>
    axiosClient.get<any[], any[]>('/transactions'),

  createTransaction: (data: any) =>
    axiosClient.post('/transactions', data),

  updateTransaction: (id: string, data: any) =>
    axiosClient.put(`/transactions/${id}`, data),

  deleteTransaction: (id: string) =>
    axiosClient.delete(`/transactions/${id}`),

  // Notification APIs
  getNotifications: (params?: {
    unreadOnly?: boolean;
    type?: string;
    tripId?: number;
    busId?: number;
    roundId?: number;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => axiosClient.get('/notifications', { params }),

  markNotificationAsRead: (id: number) =>
    axiosClient.patch(`/notifications/${id}/read`),

  markAllNotificationsAsRead: () =>
    axiosClient.patch('/notifications/read-all'),
  
  deleteNotification : (id : number) =>
    axiosClient.delete(`/notifications/${id}`),

  deleteAllNotifications : () =>
    axiosClient.delete('/notifications'),

  getBusRoundStatuses: (tripId: string) =>
    axiosClient.get('/bus-round-status', { params: { tripId } }),

  confirmBusRoundChecks: (busId: number, roundId: number, data: { checkInLocked?: boolean; checkOutLocked?: boolean }) =>
    axiosClient.post(`/buses/${busId}/rounds/${roundId}/confirm-checks`, data),

  confirmBusRoundCompletion: (busId: number, roundId: number) =>
    axiosClient.post(`/buses/${busId}/rounds/${roundId}/confirm-completion`),
  
  getPendingUnlockRequests: (tripId?: string, roundId?: string) =>
  axiosClient.get('/unlock-requests/pending', {
    params: tripId ? { tripId, roundId } : {},
  }),

  createUnlockRequest: (
    busId: number,
    roundId: number,
    data: {
      type: 'check_in' | 'check_out';
      reason?: string;
    }
  ) =>
    axiosClient.post(
      `/unlock-requests/bus/${busId}/round/${roundId}`,
      data
    ),

  approveUnlockRequest: (requestId: number) =>
    axiosClient.post(`/unlock-requests/${requestId}/approve`),

  rejectUnlockRequest: (
    requestId: number,
    data?: {
      rejectReason?: string;
    }
  ) =>
    axiosClient.post(`/unlock-requests/${requestId}/reject`, data),

  };
export default api;