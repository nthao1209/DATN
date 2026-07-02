import React , {useEffect, useRef} from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { BusOption, RoundOption, TripOption } from './types';
import './TransactionFilters.css';

type TransactionFiltersProps = {
  trips: TripOption[];
  buses: BusOption[];
  rounds: RoundOption[];
  selectedTripId: number | null;
  selectedBusIds: number[];
  selectedRoundIds: number[];
  tripDropdownOpen: boolean;
  busDropdownOpen: boolean;
  roundDropdownOpen: boolean;
  setSelectedTripId: (tripId: number) => void;
  setTripDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  tripDropdownOpen,
  busDropdownOpen,
  roundDropdownOpen,
  setTripDropdownOpen,
  setSelectedTripId,
  setBusDropdownOpen,
  setRoundDropdownOpen,
  toggleBus,
  toggleRound,
  onTripChange,
}) => {
  const tripMenuRef = useRef<HTMLDivElement>(null);
  const busMenuRef = useRef<HTMLDivElement>(null);
  const roundMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if(tripMenuRef.current && !tripMenuRef.current.contains(event.target as Node)) {
        setTripDropdownOpen(false);
      }
      if (busMenuRef.current && !busMenuRef.current.contains(event.target as Node)) {
        setBusDropdownOpen(false);
      }
      if (roundMenuRef.current && !roundMenuRef.current.contains(event.target as Node)) {
        setRoundDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setTripDropdownOpen, setBusDropdownOpen, setRoundDropdownOpen]);
    const selectedTripName = trips.find(t => t.id === selectedTripId)?.name || 'Chưa chọn chuyến đi';

 return (
    <div className="row g-3 align-items-end">
      {/* 1. CHUYẾN ĐI */}
      <div ref={tripMenuRef} className="col-12 col-md-4 position-relative transaction-filter-column">
        <label className="filter-label">Chuyến đi</label>
        <button
          type="button"
          className={`custom-filter-input d-flex align-items-center justify-content-between w-100 ${tripDropdownOpen ? 'active' : ''}`}
          onClick={() => setTripDropdownOpen((v) => !v)}
        >
          <span className="trip-filter-text text-start pe-2">
            {selectedTripName}
          </span>
          <ChevronDown size={16} className={`flex-shrink-0 transition-all ${tripDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {tripDropdownOpen && (
          <div className="custom-multi-menu shadow-lg animate-fade-in w-100">
            <div className="menu-header">Chọn chuyến đi</div>
            <div className="menu-body">
              {trips.map((trip) => {
                const id = Number(trip.id);
                const isSelected = selectedTripId === id;
                return (
                  <div 
                    key={id} 
                    className={`multi-item-custom ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTripId(id);
                      setTripDropdownOpen(false);
                      onTripChange?.();
                    }}
                  >
                    <span className="trip-menu-text">{trip.name}</span>
                    {isSelected && <Check size={16} className="ms-auto flex-shrink-0 transaction-filter-check" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* 2. CHỌN XE */}
      <div 
      ref={busMenuRef}
      className="col-12 col-md-4 position-relative">
        <label className="filter-label">Xe vận hành</label>
        <button
          type="button"
          className={`custom-filter-input d-flex align-items-center justify-content-between w-100 ${busDropdownOpen ? 'active' : ''}`}
          onClick={() => setBusDropdownOpen((v) => !v)}
        >
        <span className="text-truncate">
          {selectedBusIds.length === 0 ? (
            'Chưa chọn xe'
          ) : selectedBusIds.length === 1 ? (
            buses.find(b => Number(b.id) === selectedBusIds[0])?.busCode || 
            buses.find(b => Number(b.id) === selectedBusIds[0])?.registrationNumber || '1 xe đã chọn'
          ) : selectedBusIds.length === buses.length ? (
            'Tất cả xe'
          ) : (
            `${selectedBusIds.length} xe đã chọn`
          )}
        </span>
          <ChevronDown size={16} className={`transition-all ${busDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {busDropdownOpen && (
          <div className="custom-multi-menu shadow-lg animate-fade-in">
            <div className="menu-header">Chọn danh sách xe</div>
            <div className="menu-body">
              {buses.map((bus) => {
                const id = Number(bus.id);
                const isSelected = selectedBusIds.includes(id);
                return (
                  <label key={id} className={`multi-item-custom ${isSelected ? 'selected' : ''}`}>
                    <div className="checkbox-custom">
                      {isSelected && <Check size={12} strokeWidth={4} color="white" />}
                    </div>
                    <input type="checkbox" className="d-none" checked={isSelected} onChange={() => toggleBus(id)} />
                    <span className="ms-2">{bus.busCode || bus.registrationNumber}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. CHỌN LƯỢT */}
      <div 
        ref={roundMenuRef}
        className="col-12 col-md-4 position-relative">
        <label className="filter-label">Lượt di chuyển</label>
        <button
          type="button"
          className={`custom-filter-input d-flex align-items-center justify-content-between w-100 ${roundDropdownOpen ? 'active' : ''}`}
          onClick={() => setRoundDropdownOpen((v) => !v)}
        >
        <span className="text-truncate">
          {selectedRoundIds.length === 0 ? (
            'Chưa chọn lượt'
          ) : selectedRoundIds.length === 1 ? (
            rounds.find(r => Number(r.id) === selectedRoundIds[0])?.name || `Lượt ${selectedRoundIds[0]}`
          ) : selectedRoundIds.length === rounds.length ? (
            'Tất cả lượt'
          ) : (
            `${selectedRoundIds.length} lượt đã chọn`
          )}
        </span>
          <ChevronDown size={16} className={`transition-all ${roundDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {roundDropdownOpen && (
          <div className="custom-multi-menu shadow-lg animate-fade-in">
            <div className="menu-header">Chọn lượt đi/về</div>
            <div className="menu-body">
              {rounds.map((round) => {
                const id = Number(round.id);
                const isSelected = selectedRoundIds.includes(id);
                return (
                  <label key={id} className={`multi-item-custom ${isSelected ? 'selected' : ''}`}>
                    <div className="checkbox-custom">
                      {isSelected && <Check size={12} strokeWidth={4} color="white" />}
                    </div>
                    <input type="checkbox" className="d-none" checked={isSelected} onChange={() => toggleRound(id)} />
                    <span className="ms-2">{round.name || `Lượt ${id}`}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default TransactionFilters;
