import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { areNumberArraysEqual } from './helpers';
import type { BusOption, RoundOption, TripOption } from './types';

export const useTransactionSelection = () => {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [tripDropdownOpen, setTripDropdownOpen] = useState(false);
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [departureRoundFilter, setDepartureRoundFilter] = useState<number | null>(null);
  const [returnRoundFilter, setReturnRoundFilter] = useState<number | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setBusDropdownOpen(false);
        setRoundDropdownOpen(false);
        setTripDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    selectedTripId,
    setSelectedTripId,
    selectedBusIds,
    setSelectedBusIds,
    selectedRoundIds,
    setSelectedRoundIds,
    tripDropdownOpen,
    setTripDropdownOpen,
    busDropdownOpen,
    setBusDropdownOpen,
    roundDropdownOpen,
    setRoundDropdownOpen,
    departureRoundFilter,
    setDepartureRoundFilter,
    returnRoundFilter,
    setReturnRoundFilter,
    filterDropdownRef,
  };
};

export const useTransactionSelectionDataSync = ({
  trips,
  buses,
  rounds,
  selectedTripId,
  setSelectedTripId,
  selectedRoundIds,
  setSelectedBusIds,
  setSelectedRoundIds,
  departureRoundFilter,
  setDepartureRoundFilter,
  returnRoundFilter,
  setReturnRoundFilter,
}: {
  trips: TripOption[];
  buses: BusOption[];
  rounds: RoundOption[];
  selectedTripId: number | null;
  setSelectedTripId: Dispatch<SetStateAction<number | null>>;
  selectedRoundIds: number[];
  setSelectedBusIds: Dispatch<SetStateAction<number[]>>;
  setSelectedRoundIds: Dispatch<SetStateAction<number[]>>;
  departureRoundFilter: number | null;
  setDepartureRoundFilter: Dispatch<SetStateAction<number | null>>;
  returnRoundFilter: number | null;
  setReturnRoundFilter: Dispatch<SetStateAction<number | null>>;
}) => {
  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(Number(trips[0].id));
    }
  }, [selectedTripId, setSelectedTripId, trips]);

  useEffect(() => {
    if (!buses.length) {
      setSelectedBusIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedBusIds((prev) => {
      if (!prev.length) {
        const next = buses.map((bus) => Number(bus.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }

      const valid = prev.filter((id) => buses.some((bus) => Number(bus.id) === id));
      const next = valid.length ? valid : buses.map((bus) => Number(bus.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [buses, setSelectedBusIds]);

  useEffect(() => {
    if (!rounds.length) {
      setSelectedRoundIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedRoundIds((prev) => {
      if (!prev.length) {
        const next = rounds.map((round) => Number(round.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }

      const valid = prev.filter((id) => rounds.some((round) => Number(round.id) === id));
      const next = valid.length ? valid : rounds.map((round) => Number(round.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [rounds, setSelectedRoundIds]);

  useEffect(() => {
    if (departureRoundFilter && !selectedRoundIds.includes(departureRoundFilter)) {
      setDepartureRoundFilter(null);
    }

    if (returnRoundFilter && !selectedRoundIds.includes(returnRoundFilter)) {
      setReturnRoundFilter(null);
    }
  }, [
    departureRoundFilter,
    returnRoundFilter,
    selectedRoundIds,
    setDepartureRoundFilter,
    setReturnRoundFilter,
  ]);
};
