import { getResolvedAttendanceState } from '../../../utils/attendanceStats';

export const formatCount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

export const buildTripCards = ({
  trips,
  buses,
  rounds,
  passengers,
}: {
  trips: any[];
  buses: any[];
  rounds: any[];
  passengers: any[];
}) =>
  trips.map((trip: any) => {
    const tripId = Number(trip.id);
    const passengersOfTrip = passengers.filter((passenger: any) => Number(passenger.bus?.trip?.id) === tripId);
    return {
      id: tripId,
      name: trip.name || `Trip ${tripId}`,
      status: String(trip.status || '').toUpperCase(),
      busCount: Number(trip?._count?.buses || buses.filter((bus: any) => Number(bus.trip?.id) === tripId).length),
      roundCount: Number(trip?._count?.rounds || rounds.filter((round: any) => Number(round.trip?.id) === tripId).length),
      passengerCount: passengersOfTrip.length,
    };
  });

export const buildAttendanceSummary = (transactions: any[]) =>
  transactions.reduce(
    (summary, tx) => {
      const state = getResolvedAttendanceState(tx);
      if (state.checkIn) summary.checkInCount += 1;
      if (state.checkOut) summary.checkOutCount += 1;
      return summary;
    },
    { checkInCount: 0, checkOutCount: 0 }
  );
