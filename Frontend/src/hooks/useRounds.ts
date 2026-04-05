import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export const useRounds = (tripId?: string) => {
  const queryClient = useQueryClient();

  // Get all rounds
  const getRoundsFn = () => {
    if (!tripId) return Promise.resolve([]);
    return api.getRounds(tripId);
  };

  // Create round
  const createRound = useMutation({
    mutationFn: (data: any) => {
      if (!tripId) {
        throw new Error('tripId is required');
      }
      const roundData = { ...data };
      return api.createRound(tripId, roundData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', tripId] });
    },
    onError: (error: any) => {
      console.error('Failed to create round:', error);
    }
  });

  // Update round
  const updateRound = useMutation({
    mutationFn: (data: any) => api.updateRound(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', tripId] });
    },
    onError: (error: any) => {
      console.error('Failed to update round:', error);
    }
  });

  // Delete round
  const deleteRound = useMutation({
    mutationFn: (id: string) => api.deleteRound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', tripId] });
    },
    onError: (error: any) => {
      console.error('Failed to delete round:', error);
    }
  });

  return {
    getRoundsFn,
    createRound,
    updateRound,
    deleteRound
  };
};
