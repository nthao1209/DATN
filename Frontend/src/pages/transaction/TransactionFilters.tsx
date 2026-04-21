import React from 'react';
import type { BusOption, RoundOption, TripOption } from './types';

type TransactionFiltersProps = {
  trips: TripOption[];
  buses: BusOption[];
  rounds: RoundOption[];
  selectedTripId: number | null;
  selectedBusIds: number[];
  selectedRoundIds: number[];
  busDropdownOpen: boolean;
  roundDropdownOpen: boolean;
  setSelectedTripId: (tripId: number) => void;
  setBusDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRoundDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleBus: (busId: number) => void;
  toggleRound: (roundId: number) => void;
  onTripChange?: () => void;
};

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  trips,
  buses,
  rounds,
  selectedTripId,
  selectedBusIds,
  selectedRoundIds,
  busDropdownOpen,
  roundDropdownOpen,
  setSelectedTripId,
  setBusDropdownOpen,
  setRoundDropdownOpen,
  toggleBus,
  toggleRound,
  onTripChange,
}) => {
  return (
    <div className="row g-2 mt-1">
      <div className="col-12 col-md-4">
        <label className="form-label form-label-sm mb-1">Chuyến đi</label>
        <select
          className="form-select form-select-sm"
          value={selectedTripId ?? ''}
          onChange={(e) => {
            setSelectedTripId(Number(e.target.value));
            onTripChange?.();
          }}
        >
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>

      <div className="col-12 col-md-4 position-relative">
        <label className="form-label form-label-sm mb-1">Xe</label>
        <button
          type="button"
          className="form-select form-select-sm text-start"
          onClick={() => setBusDropdownOpen((v) => !v)}
        >
          {selectedBusIds.length === buses.length
            ? 'Chọn nhiều'
            : `${selectedBusIds.length} xe đã chọn`}
        </button>
        {busDropdownOpen && (
          <div className="multi-menu shadow-sm">
            {buses.map((bus) => {
              const id = Number(bus.id);
              return (
                <label key={id} className="multi-item">
                  <input
                    type="checkbox"
                    checked={selectedBusIds.includes(id)}
                    onChange={() => toggleBus(id)}
                  />
                  <span>{bus.busCode || bus.registrationNumber || `Xe ${id}`}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="col-12 col-md-4 position-relative">
        <label className="form-label form-label-sm mb-1">Lượt</label>
        <button
          type="button"
          className="form-select form-select-sm text-start"
          onClick={() => setRoundDropdownOpen((v) => !v)}
        >
          {selectedRoundIds.length === rounds.length
            ? 'Chọn nhiều'
            : `${selectedRoundIds.length} lượt đã chọn`}
        </button>
        {roundDropdownOpen && (
          <div className="multi-menu shadow-sm">
            {rounds.map((round) => {
              const id = Number(round.id);
              return (
                <label key={id} className="multi-item">
                  <input
                    type="checkbox"
                    checked={selectedRoundIds.includes(id)}
                    onChange={() => toggleRound(id)}
                  />
                  <span>{round.name || `Lượt ${id}`}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionFilters;
