import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export const useBuses = (tripId?: string) => {
  const queryClient = useQueryClient();

  // Get all buses
  const getBusesFn = () => {
    if (!tripId) return Promise.resolve([]);
    return api.getBuses(tripId);
  };

  // Create bus
  const createBus = useMutation({
    mutationFn: (data: any) => {
      const targetTripId = data.tripId || tripId;
      if (!targetTripId) {
        throw new Error('tripId is required');
      }
      const busData = { ...data };
      delete busData.tripId;
      return api.createBus(targetTripId, busData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses', tripId] });
    },
    onError: (_error: any) => {
    }
  });

  // Update bus
  const updateBus = useMutation({
    mutationFn: (data: any) => api.updateBus(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses', tripId] });
    },
    onError: (_error: any) => {
    }
  });

  // Delete bus
  const deleteBus = useMutation({
    mutationFn: (id: string) => api.deleteBus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses', tripId] });
    },
    onError: (_error: any) => {
    }
  });

  return {
    getBusesFn,
    createBus,
    updateBus,
    deleteBus
  };
};
