import { useMutation } from '@tanstack/react-query';
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
