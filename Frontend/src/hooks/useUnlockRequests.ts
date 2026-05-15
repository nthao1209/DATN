import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../services/api';

export interface UnlockRequest {
  id: number;
  busId: number;
  roundId: number;
  type: 'check_in' | 'check_out';
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: number;
  approvedBy?: number;
  createdAt: string;
  respondedAt?: string;
  bus?: {
    id: number;
    busCode: string;
    trip?: {
      id: number;
      name: string;
    };
  };
  round?: {
    id: number;
    name: string;
    time: string;
  };
  requester?: {
    id: number;
    name: string;
    email: string;
  };
  approver?: {
    id: number;
    name: string;
    email: string;
  };
}

export const useUnlockRequests = (tripId?: number, status?: string) => {
  return useQuery({
    queryKey: ['unlock-requests', tripId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tripId) params.append('tripId', String(tripId));
      if (status) params.append('status', status);
      
      const { data } = await api.get(`/unlock-requests?${params.toString()}`);
      return data as UnlockRequest[];
    },
    enabled: tripId !== undefined || status !== undefined,
  });
};

export const usePendingUnlockRequests = (busId: number) => {
  return useQuery({
    queryKey: ['pending-unlock-requests', busId],
    queryFn: async () => {
      const { data } = await api.get(`/unlock-requests/bus/${busId}/pending`);
      return data as UnlockRequest[];
    },
    enabled: !!busId,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

export const useCreateUnlockRequest = () => {
  return useMutation({
    mutationFn: async (params: {
      busId: number;
      roundId: number;
      type: 'check_in' | 'check_out';
      reason?: string;
    }) => {
      const { data } = await api.post(
        `/unlock-requests/bus/${params.busId}/round/${params.roundId}`,
        { type: params.type, reason: params.reason }
      );
      return data;
    },
  });
};

export const useApproveUnlockRequest = () => {
  return useMutation({
    mutationFn: async (requestId: number) => {
      const { data } = await api.post(`/unlock-requests/${requestId}/approve`);
      return data;
    },
  });
};

export const useRejectUnlockRequest = () => {
  return useMutation({
    mutationFn: async (params: {
      requestId: number;
      rejectReason?: string;
    }) => {
      const { data } = await api.post(`/unlock-requests/${params.requestId}/reject`, {
        rejectReason: params.rejectReason,
      });
      return data;
    },
  });
};
