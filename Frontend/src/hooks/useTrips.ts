import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export const useTrips = () => {
  const queryClient = useQueryClient();

  // Get all trips
  const getTripsFn = () => api.getTrips();

  // Create trip
  const createTrip = useMutation({
    mutationFn: (data: any) => api.createTrip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (_error: any) => {
    }
  });

  // Update trip
  const updateTrip = useMutation({
    mutationFn: (data: any) => api.updateTrip(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (_error: any) => {
    }
  });

  // Delete trip
  const deleteTrip = useMutation({
    mutationFn: (id: string) => api.deleteTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (_error: any) => {
    }
  });

  return {
    getTripsFn,
    createTrip,
    updateTrip,
    deleteTrip
  };
};
