import React , {useEffect, useRef} from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { BusOption, RoundOption, TripOption } from './types';
import { useTheme } from '../../theme/ThemeContext';

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
  const { colors, isDarkMode } = useTheme();
  const busMenuRef = useRef<HTMLDivElement>(null);
  const roundMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (busMenuRef.current && !busMenuRef.current.contains(event.target as Node)) {
        setBusDropdownOpen(false);
      }
      if (roundMenuRef.current && !roundMenuRef.current.contains(event.target as Node)) {
        setRoundDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setBusDropdownOpen, setRoundDropdownOpen]);
 return (
    <div className="row g-3 align-items-end">
      {/* 1. CHUYẾN ĐI */}
      <div className="col-12 col-md-4">
        <label className="filter-label">Chuyến đi</label>
        <div className="select-wrapper">
          <select
            className="form-select custom-filter-input"
            value={selectedTripId ?? ''}
            onChange={(e) => {
              setSelectedTripId(Number(e.target.value));
              onTripChange?.();
            }}
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.name}</option>
            ))}
          </select>
        </div>
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
            {selectedBusIds.length === buses.length ? 'Tất cả xe' : 
             selectedBusIds.length === 0 ? 'Chưa chọn xe' : `${selectedBusIds.length} xe đã chọn`}
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
            {selectedRoundIds.length === rounds.length ? 'Tất cả lượt' : 
             selectedRoundIds.length === 0 ? 'Chưa chọn lượt' : `${selectedRoundIds.length} lượt đã chọn`}
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

      <style>{`
        .filter-label {
          font-size: 12px;
          font-weight: 700;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin-bottom: 6px;
          display: block;
        }

        .custom-filter-input {
          background-color: ${isDarkMode ? '#1e293b' : '#ffffff'};
          border: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'};
          color: ${isDarkMode ? '#f1f5f9' : '#1e293b'};
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          text-align: left;
        }

        .custom-filter-input:hover {
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px ${colors.primary}15;
        }

        .custom-filter-input.active {
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px ${colors.primary}25;
        }

        .custom-multi-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: ${isDarkMode ? '#1e293b' : '#ffffff'};
          border: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'};
          border-radius: 12px;
          z-index: 1000;
          overflow: hidden;
          min-width: 220px;
        }

        .menu-header {
          padding: 10px 15px;
          background: ${isDarkMode ? '#0f172a' : '#f8fafc'};
          font-size: 11px;
          font-weight: 700;
          color: ${isDarkMode ? '#64748b' : '#94a3b8'};
          text-transform: uppercase;
          border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'};
        }

        .menu-body {
          max-height: 250px;
          overflow-y: auto;
          padding: 6px;
        }

        .multi-item-custom {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          color: ${isDarkMode ? '#cbd5e1' : '#475569'};
          font-size: 14px;
        }

        .multi-item-custom:hover {
          background: ${isDarkMode ? '#334155' : '#f1f5f9'};
        }

        .multi-item-custom.selected {
          background: ${colors.primary}10;
          color: ${colors.primary};
          font-weight: 600;
        }

        .checkbox-custom {
          width: 18px;
          height: 18px;
          border: 2px solid ${isDarkMode ? '#475569' : '#cbd5e1'};
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .selected .checkbox-custom {
          background: ${colors.primary};
          border-color: ${colors.primary};
        }

        .rotate-180 { transform: rotate(180deg); }
        .transition-all { transition: all 0.3s ease; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default TransactionFilters;