import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import api from '../services/api';
import { MqttUnlockListener } from './MqttUnlockListener';
import { ROLE_IDS } from '../auth/rbac';

export const UnlockRequestRealtimeListener = () => {
  const { roleId } = useSelector((state: RootState) => state.auth);
  const isTripAudience = roleId === ROLE_IDS.ADMIN || roleId === ROLE_IDS.BUS_MANAGEMENT;

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ['unlock-request-realtime-trips', roleId],
    queryFn: api.getTrips,
    enabled: isTripAudience,
  });

  const tripIds = useMemo(
    () => trips.map((trip) => Number(trip.id)).filter((tripId) => Number.isFinite(tripId) && tripId > 0),
    [trips],
  );

  if (!isTripAudience || tripIds.length === 0) {
    return null;
  }

  return (
    <>
      {tripIds.map((tripId) => (
        <MqttUnlockListener key={tripId} tripId={tripId} roleId={roleId} enabled />
      ))}
    </>
  );
};