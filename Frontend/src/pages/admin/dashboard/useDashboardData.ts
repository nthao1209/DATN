import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { useAttendanceRealtimeInvalidation } from '../../../hooks/useAttendanceRealtimeInvalidation';

export const useDashboardData = (tenantId?: number | string | null) => {
  const tenantKey = tenantId ? String(tenantId) : 'no-tenant';

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ['dashboard-trips', tenantKey],
    queryFn: api.getTrips,
  });

  const tripIds = useMemo(
    () => trips.map((trip: any) => Number(trip.id)).filter((id: number) => Number.isFinite(id) && id > 0),
    [trips]
  );
  const tripIdsKey = tripIds.join(',');

  const { data: buses = [] } = useQuery<any[]>({
    queryKey: ['dashboard-buses', tenantKey, tripIdsKey],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesByTrip = await Promise.all(tripIds.map((tripId) => api.getBuses(String(tripId))));
      return busesByTrip.flat();
    },
  });

  const { data: rounds = [] } = useQuery<any[]>({
    queryKey: ['dashboard-rounds', tenantKey, tripIdsKey],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const roundsByTrip = await Promise.all(tripIds.map((tripId) => api.getRounds(String(tripId))));
      return roundsByTrip.flat();
    },
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ['dashboard-passengers', tenantKey, tripIdsKey],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const passengersByTrip = await Promise.all(tripIds.map((tripId) => api.getPassengers(String(tripId))));
      return passengersByTrip.flat();
    },
  });

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ['dashboard-transactions', tenantKey],
    queryFn: api.getTransactions,
  });

  const dashboardRealtimeQueryKeys = useMemo(
    () => [
      ['dashboard-trips', tenantKey],
      ['dashboard-buses', tenantKey, tripIdsKey],
      ['dashboard-rounds', tenantKey, tripIdsKey],
      ['dashboard-passengers', tenantKey, tripIdsKey],
      ['dashboard-transactions', tenantKey],
    ],
    [tenantKey, tripIdsKey]
  );

  useAttendanceRealtimeInvalidation({
    tenantId: tenantId ? Number(tenantId) : null,
    queryKeys: dashboardRealtimeQueryKeys,
  });

  return {
    trips,
    buses,
    rounds,
    passengers,
    transactions,
  };
};
