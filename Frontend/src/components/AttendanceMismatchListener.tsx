import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { useNotification } from '../contexts/NotificationContext';
import { subscribeAttendanceUpdates } from '../services/mqtt';
import { api } from '../services/api';

export const AttendanceMismatchListener = () => {
  const { addNotification, refreshNotifications } = useNotification();

  const { user, roleId, loading: authLoading } = useSelector(
    (state: RootState) => state.auth,
  );

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: [
      'attendance-mismatch-trips',
      user?.id,
      roleId,
    ],
    queryFn: api.getTrips,
    enabled: Boolean(user?.id) && roleId === 3 && !authLoading,
  });

  const tripIds = useMemo(
    () =>
      trips
        .map((trip) => Number(trip.id))
        .filter(
          (tripId) =>
            Number.isFinite(tripId) && tripId > 0,
        ),
    [trips],
  );

  useEffect(() => {
    if (
      authLoading ||
      !user?.id ||
      roleId !== 3 ||
      !tripIds.length
    ) {
      return;
    }

    const subscriptions = tripIds.map((tripId) =>
      subscribeAttendanceUpdates(
        tripId,
        async (message) => {
          if (
            message.type !==
            'attendance.requires_review'
          ) {
            return;
          }

          if (!message.targetManagerId) {
            return;
          }

          if (
            Number(message.targetManagerId) !==
            Number(user.id)
          ) {
            return;
          }

          let passengerName = message.passengerName || `#${message.passengerId}`;
          if (!message.passengerName) {
            try {
              const list = await api.getPassengers(String(message.tripId));
              const found = (list as any[]).find((p) => Number(p.id) === Number(message.passengerId));
              if (found && found.name) passengerName = found.name;
            } catch (e) {
            }
          }

          // Xe biên chế
          const correctBus = message.passengerBusCode || `xe ${message.passengerBusId}`;

          // Xe hiện tại thực tế
          const currentBus = message.busCode || `xe ${message.busId}`;

          const roundName = message.roundName || `tuyến #${message.roundId}`;


          const isMismatch =
            Number(message.passengerBusId) !==
            Number(message.busId);

          if (!isMismatch) {
            return;
          }

          const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

          const shortText = `Khách ${passengerName} của ${correctBus} vừa được điểm danh trên ${currentBus} ở ${truncate(roundName, 40)}.`;

          addNotification(shortText, 'warning', 10000, { showToast: true });
          void refreshNotifications();
        },
      ),
    );

    return () => {
      subscriptions.forEach((subscription) =>
        subscription.end(true),
      );
    };
  }, [
    addNotification,
    authLoading,
    roleId,
    refreshNotifications,
    tripIds,
    user?.id,
  ]);

  return null;
};