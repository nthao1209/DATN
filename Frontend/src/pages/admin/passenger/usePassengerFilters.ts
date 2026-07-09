import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import type { BusesByTrip, PassengerBus, PassengerTrip } from './types';

export const usePassengerFilters = () => {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const { data: trips = [] } = useQuery<PassengerTrip[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const tripIds = useMemo(() => trips.map((trip: any) => trip.id), [trips]);

  const { data: allBuses = [] } = useQuery<PassengerBus[]>({
    queryKey: ['buses-all-trips', tripIds],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesPerTrip = await Promise.all(
        tripIds.map((id) => api.getBuses(String(id)))
      );
      return busesPerTrip.flat();
    },
  });

  const { data: passengers = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId, selectedBusId],
    enabled: trips.length > 0,
    queryFn: async () => {
      if (selectedTripId) {
        return api.getPassengers(
          String(selectedTripId),
          selectedBusId ? String(selectedBusId) : undefined
        );
      }

      const passengersPerTrip = await Promise.all(
        trips.map((trip) => api.getPassengers(String(trip.id)))
      );
      return passengersPerTrip.flat();
    },
  });

  useEffect(() => {
    if (selectedTripId == null) {
      if (selectedBusId !== null) setSelectedBusId(null);
      return;
    }

    const busesOfSelectedTrip = allBuses.filter(
      (bus: any) => Number(bus.trip?.id) === selectedTripId
    );
    const exists = busesOfSelectedTrip.some((bus) => Number(bus.id) === selectedBusId);

    if (!exists && selectedBusId !== null) setSelectedBusId(null);
  }, [selectedTripId, selectedBusId, allBuses]);

  const busesByTrip = useMemo<BusesByTrip>(() => {
    const map: BusesByTrip = {};
    allBuses.forEach((bus: any) => {
      const tripId = Number(bus.trip?.id ?? selectedTripId ?? 0);
      if (!map[tripId]) map[tripId] = [];
      map[tripId].push(bus);
    });
    return map;
  }, [allBuses, selectedTripId]);

  const busOptions = useMemo(() => {
    const options = !selectedTripId ? [] : busesByTrip[selectedTripId] || [];
    return [...options].sort((a, b) =>
      (a.busCode || '').localeCompare(b.busCode || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );
  }, [busesByTrip, selectedTripId]);

  const isAllTripsView = selectedTripId === null && selectedBusId === null;
  const isTargetSelectionReady = Boolean(selectedTripId && selectedBusId);
  const isPassengerEditingLocked = !isTargetSelectionReady;

  return {
    selectedTripId,
    setSelectedTripId,
    selectedBusId,
    setSelectedBusId,
    open,
    setOpen,
    trips,
    passengers,
    isLoading,
    isError,
    refetch,
    busesByTrip,
    busOptions,
    isAllTripsView,
    isTargetSelectionReady,
    isPassengerEditingLocked,
  };
};
