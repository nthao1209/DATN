import axios from 'axios';
import { auth as fbAuth } from '../config/firebase';


const axiosClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Tự động đính kèm Token trước mỗi request
axiosClient.interceptors.request.use(async (config: any) => {
  const user = fbAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Chỉ lấy data từ response trả về
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.response?.data?.message || "Lỗi kết nối server";
    return Promise.reject(new Error(message));
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
  syncUser: (data: { email: string; name: string; firebaseUid: string }) => 
    axiosClient.post('/auth/sync', data),

  getMyStatus: () => 
    axiosClient.get('/auth/status'), // Trả về { user, tenants: [] }

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
  getPassengers: (tripId: string, busId?: string) =>
    axiosClient.get<any[], any[]>(
      busId
        ? `/trips/${tripId}/passengers?busId=${busId}`
        : `/trips/${tripId}/passengers`
    ),

  createPassenger: (tripId: string, data: any) =>
    axiosClient.post(`/trips/${tripId}/passengers`, data),

  updatePassenger: (id: string, data: any) =>
    axiosClient.put(`/passengers/${id}`, data),

  deletePassenger: (id: string) =>
    axiosClient.delete(`/passengers/${id}`),
}

export default api;