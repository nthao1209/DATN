import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { useNotification } from '../contexts/NotificationContext';
import { subscribeAttendanceUpdates } from '../services/mqtt';
import { api } from '../services/api';

export const AttendanceMismatchListener = () => {
  const { addNotification } = useNotification();
  const { user, roleId } = useSelector((state: RootState) => state.auth);

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ['attendance-mismatch-trips', user?.id, roleId],
    queryFn: api.getTrips,
    enabled: Boolean(user?.id) && roleId === 3,
  });

  const tripIds = useMemo(
    () => trips.map((trip) => Number(trip.id)).filter((tripId) => Number.isFinite(tripId) && tripId > 0),
    [trips],
  );

  useEffect(() => {
    if (!user?.id || roleId !== 3 || !tripIds.length) {
      return;
    }

    const subscriptions = tripIds.map((tripId) =>
      subscribeAttendanceUpdates(tripId, (message) => {
        if (!message.targetManagerId) {
          return;
        }

        if (Number(message.targetManagerId) !== Number(user.id)) {
          return;
        }

        if (Number(message.passengerBusId) === Number(message.busId)) {
          return;
        }

        const passengerName = message.passengerName || `khách #${message.passengerId}`;
        const correctBus = message.passengerBusCode || `xe ${message.passengerBusId}`;
        const currentBus = message.actualBusCode || message.busCode || `xe ${message.busId}`;
        const roundName = message.roundName || `tuyến #${message.roundId}`;

        addNotification(
          `Khách ${passengerName} thuộc ${correctBus} nhưng vừa được điểm danh trên ${currentBus} ở ${roundName}.`,
          'warning',
          7000,
        );
      }),
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.end(true));
    };
  }, [addNotification, roleId, tripIds, user?.id]);

  return null;
};