import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, RefreshCw, UserPlus} from 'lucide-react';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { subscribeAttendanceUpdates } from '../services/mqtt';
import { buildTransactionColumns } from './transaction/columns';
import type {
  BusOption,
  DraftCell,
  PassengerRow,
  RoundOption,
  TransactionRecord,
  TransactionTableRow,
  TripOption,
} from './transaction/types';
import { keyOf } from './transaction/types';
import TransactionFilters from './transaction/TransactionFilters';
import { useTransactionSync } from './transaction/useTransactionSync';
import useDebounce from '../hooks/useDebounce';
import { useTheme } from '../theme/ThemeContext';
import { OFFLINE_QUEUE_SYNCED_EVENT } from '../services/offlineSync';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';
import { useSnackbar } from 'notistack';
import ExtraPassengerPanel from './transaction/ExtraPassengerPanel';  
import ExportExcelButton from './transaction/ExportExcelButton';
import TransactionHeader from './transaction/TransactionHeader';
import ConfirmRoundPanel from './transaction/ConfirmRoundPanel';
import SyncStatusBanner from './transaction/SyncStatusBanner';
import { useRoundLocks } from '../hooks/useRoundLocks';

const TransactionPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [tripDropdownOpen, setTripDropdownOpen] = useState(false);
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [departureRoundFilter, setDepartureRoundFilter] = useState<number | null>(null);
  const [returnRoundFilter, setReturnRoundFilter] = useState<number | null>(null);
  const [showAddPassengerPanel, setShowAddPassengerPanel] = useState(false);
  const [extraPassengers, setExtraPassengers] = useState<PassengerRow[]>([]);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const areNumberArraysEqual = (left: number[], right: number[]) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => Number(value) === Number(right[index]));
  };

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
  }, [setBusDropdownOpen, setRoundDropdownOpen, setTripDropdownOpen]);

  
  const {
    data: trips = [],
    isLoading: tripsLoading,
  } = useQuery<TripOption[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const {
    data: buses = [],
    isLoading: busesLoading,
  } = useQuery<BusOption[]>({
    queryKey: ['transaction-buses', selectedTripId],
    queryFn: () => api.getBuses(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const {
    data: rounds = [],
    isLoading: roundsLoading,
  } = useQuery<RoundOption[]>({
    queryKey: ['transaction-rounds', selectedTripId],
    queryFn: () => api.getRounds(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const {
    data: passengers = [],
    isLoading: passengersLoading,
    refetch: refetchPassengers,
  } = useQuery<any[]>({
    queryKey: ['transaction-passengers', selectedTripId],
    queryFn: () => api.getAttendancePassengers(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery<TransactionRecord[]>({
    queryKey: ['transactions', selectedTripId],
    queryFn: () => api.getTransactions(),
    enabled: !!selectedTripId,
  });

    const getActualBusId = (
      passengerId: number,
      roundId: number,
      assignedBusId?: number | null
    ) => {
      const key = keyOf(passengerId, roundId);

      // Ưu tiên xe thực tế đã lưu DB
      const txCell = txMap[key];

      if (txCell?.busId) {
        return Number(txCell.busId);
      }

      // Nếu chưa có transaction
      // dùng xe biên chế để check lock
      if (assignedBusId) {
        return Number(assignedBusId);
      }

      return null;
    };
    
  const { isLocked, refetchLocks } = useRoundLocks(
    selectedTripId,
    getActualBusId
  );

  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(Number(trips[0].id));
    }
  }, [selectedTripId, trips]);

  useEffect(() => {
    setExtraPassengers([]);
    setShowAddPassengerPanel(false);
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;

    const client = subscribeAttendanceUpdates(selectedTripId, async () => {
      await Promise.all([refetchTransactions(), refetchPassengers()]);
    });

    return () => {
      client.end(true);
    };
  }, [selectedTripId, refetchPassengers, refetchTransactions]);

  useEffect(() => {
    if (!buses.length) {
      setSelectedBusIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedBusIds((prev) => {
      if (!prev.length) {
        const next = buses.map((b) => Number(b.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }
      const valid = prev.filter((id) => buses.some((b) => Number(b.id) === id));
      const next = valid.length ? valid : buses.map((b) => Number(b.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [buses]);

 

  useEffect(() => {
    if (!rounds.length) {
      setSelectedRoundIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedRoundIds((prev) => {
      if (!prev.length) {
        const next = rounds.map((r) => Number(r.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }
      const valid = prev.filter((id) => rounds.some((r) => Number(r.id) === id));
      const next = valid.length ? valid : rounds.map((r) => Number(r.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [rounds]);

  useEffect(() => {
    if (departureRoundFilter && !selectedRoundIds.includes(departureRoundFilter)) {
      setDepartureRoundFilter(null);
    }

    if (returnRoundFilter && !selectedRoundIds.includes(returnRoundFilter)) {
      setReturnRoundFilter(null);
    }
  }, [departureRoundFilter, returnRoundFilter, selectedRoundIds]);

  const storageKey = useMemo(
    () => (selectedTripId ? `transaction_draft_${selectedTripId}` : ''),
    [selectedTripId]
  );
  const debouncedDraftJson = useDebounce(JSON.stringify(draftMap), 600);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, DraftCell & { note?: string }>;
      const migratedDrafts = Object.fromEntries(
        Object.entries(parsed || {}).map(([key, cell]) => {
          const legacyNote = (cell as any).note;
          if (legacyNote && !cell.checkInNote && !cell.checkOutNote) {
            return [key, { ...cell, checkInNote: legacyNote, checkOutNote: legacyNote }];
          }

          return [key, cell];
        })
      ) as Record<string, DraftCell>;
      setDraftMap(migratedDrafts);
    } catch {
      setDraftMap({});
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, debouncedDraftJson);
  }, [debouncedDraftJson, storageKey]);

  useEffect(() => {
    const handleQueueSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (!detail?.storageKey || detail.storageKey !== storageKey) {
        return;
      }

      setDraftMap({});
      localStorage.removeItem(storageKey);
      refetchTransactions();
      refetchPassengers();
    };

    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    return () => window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
  }, [refetchPassengers, refetchTransactions, storageKey]);

  const txMap = useMemo(() => {
    const map: Record<string, DraftCell> = {};
    transactions.forEach((tx) => {
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const roundId = Number(tx.roundId ?? tx.round?.id ?? 0);
      const busId = Number(tx.busId ?? tx.bus?.id ?? 0);
      if (!passengerId || !roundId || !busId) return;
      map[keyOf(passengerId, roundId)] = {
        transactionId: Number(tx.id),
        passengerId,
        roundId,
        busId,
        checkIn: Boolean(tx.checkIn),
        checkOut: Boolean(tx.checkOut),
        checkInNote: tx.checkInNote || '',
        checkOutNote: tx.checkOutNote || '',
      };
    });
    return map;
  }, [transactions]);

  const normalizeNote = (note?: string | null) => (note ?? '').trim();

 const isSameCell = (current: DraftCell, base?: DraftCell) => {
  if (!base) {
    return (
      current.checkIn === false &&
      current.checkOut === false &&
      normalizeNote(current.checkInNote) === '' &&
      normalizeNote(current.checkOutNote) === ''
    );
  }

  return (
    current.checkIn === Boolean(base.checkIn) &&
    current.checkOut === Boolean(base.checkOut) &&
    normalizeNote(current.checkInNote) === normalizeNote(base.checkInNote) &&
    normalizeNote(current.checkOutNote) === normalizeNote(base.checkOutNote) &&
    current.busId === base.busId
  );
};


  const busFilteredPassengers = useMemo<PassengerRow[]>(() => {
    return passengers
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name || '',
        tel: p.tel || '',
        busId: p.bus?.id ? Number(p.bus.id) : null,
        busName: p.bus?.busCode || p.bus?.registrationNumber || '',
        assignedBusName: p.bus?.busCode || p.bus?.registrationNumber || '',
      }))
      .filter((p: PassengerRow) => p.busId && selectedBusIds.includes(Number(p.busId)));
  }, [passengers, selectedBusIds]);

   const transactionBackedPassengers = useMemo<PassengerRow[]>(() => {
    const passengersById = new Map<number, PassengerRow>();
    const passengerDict = new Map(passengers.map((p: any) =>[Number(p.id), p]));

    transactions.forEach((tx) => {
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const actualBusId = Number(tx.busId ?? tx.bus?.id ?? 0);
      const assignedBusId = Number(tx.passenger?.busId ?? tx.passenger?.bus?.id ?? 0);
      if (!passengerId || !actualBusId) return;

      const isInActualBusFilter = selectedBusIds.includes(actualBusId);
      const isInAssignedBusFilter = assignedBusId ? selectedBusIds.includes(assignedBusId) : false;
      if (!isInActualBusFilter && !isInAssignedBusFilter) return;

      if (passengersById.has(passengerId)) return;

      const assignedFromPassengerList = passengerDict.get(passengerId);
      const assignedBusName =
        assignedFromPassengerList?.bus?.busCode ||
        assignedFromPassengerList?.bus?.registrationNumber ||
        tx.passenger?.bus?.busCode ||
        tx.passenger?.bus?.registrationNumber ||
        '';

      passengersById.set(passengerId, {
        id: passengerId,
        name: tx.passenger?.name || '',
        tel: tx.passenger?.tel || '',
        busId: actualBusId,
        busName: tx.bus?.busCode || tx.bus?.registrationNumber || '',
        assignedBusName,
      });
    });

    return Array.from(passengersById.values());
  }, [transactions, selectedBusIds, passengers]);

  

  const addExtraPassenger = (passenger: PassengerRow) => {
    setExtraPassengers((prev) => {
      if(prev.some(p => p.id === passenger.id)) return prev;
      return [...prev, passenger];
    });
  };

  const assignedBusByPassengerId = useMemo(() => {
    const map = new Map<number, number | null>();
    passengers.forEach((p: any) => {
      map.set(Number(p.id), p.bus?.id ? Number(p.bus.id) : null);
    });
    return map;
  }, [passengers]);

  const canRemovePassenger = (row: PassengerRow) => {
    const assignedBusId = assignedBusByPassengerId.get(Number(row.id));
    if (!assignedBusId) return false;
    return !selectedBusIds.includes(Number(assignedBusId));
  };

  const handleRemovePassengerFromTransaction = async (row: PassengerRow) => {
    if (!selectedTripId) return;

    if (!canRemovePassenger(row)) {
      enqueueSnackbar('Không được xóa khách thuộc biên chế xe bạn quản lý. Chỉ được xóa khách thuộc xe khác.', { variant: 'warning' });
      return;
    }

    const ok = window.confirm(`Xóa khách ${row.name} khỏi transaction của chuyến hiện tại?`);
    if (!ok) return;

    try {
      const txToDelete = transactions.filter((tx) => {
        const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
        const tripId = Number(tx.round?.tripId ?? 0);
        return passengerId === Number(row.id) && tripId === Number(selectedTripId);
      });

      if (txToDelete.length > 0) {
        await Promise.all(txToDelete.map((tx) => api.deleteTransaction(String(tx.id))));
      }

      setDraftMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${row.id}_`)) {
            delete next[key];
          }
        });
        return next;
      });

      setExtraPassengers((prev) => prev.filter((p) => p.id !== row.id));

      await Promise.all([refetchTransactions(), refetchPassengers()]);
      enqueueSnackbar('Đã xóa khách khỏi transaction', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không thể xóa khách khỏi transaction', { variant: 'error' });
    }
  };

  const removeExtraPassenger = (passengerId: number) => {
    setExtraPassengers((prev) => prev.filter((p) => p.id !== passengerId));
  };

 

  const displayedPassengers = useMemo<PassengerRow[]>(() => {
    const map = new Map<number, PassengerRow>();
    busFilteredPassengers.forEach((p) => map.set(p.id, p));
    transactionBackedPassengers.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [busFilteredPassengers, transactionBackedPassengers]);

  const existingPassengerIds = useMemo(() => displayedPassengers.map((p) => p.id), [displayedPassengers]);

  
  const selectedRounds = useMemo(
    () => rounds.filter((r) => selectedRoundIds.includes(Number(r.id))),
    [rounds, selectedRoundIds]
  );

  const getCell = (passengerId: number, roundId: number): DraftCell | null => {
    const key = keyOf(passengerId, roundId);
    return draftMap[key] || txMap[key] || null;
  };

  const setCell = (payload: DraftCell) => {
  const key = keyOf(payload.passengerId, payload.roundId);

  const baseCell = txMap[key];

      try {
        const lockedIn = isLocked(
          payload.passengerId,
          payload.busId,
          Number(payload.roundId),
          'checkIn'
        );

        const lockedOut = isLocked(
          payload.passengerId,
          payload.busId,
          Number(payload.roundId),
          'checkOut'
        );
        const oldCell = getCell(payload.passengerId, payload.roundId);

        const changingCheckIn =
          payload.checkIn !== undefined &&
          payload.checkIn !== oldCell?.checkIn;

        const changingCheckOut =
          payload.checkOut !== undefined &&
          payload.checkOut !== oldCell?.checkOut;

        if (
          (changingCheckIn && lockedIn) ||
          (changingCheckOut && lockedOut)
        ) {
          enqueueSnackbar(
            'Lượt đã bị khóa, không thể chỉnh sửa điểm danh.',
            {
              variant: 'warning',
            }
          );
          return;
        }
                
      } catch (e) {
        console.error('Lock check error:', e);
      }

    const defaultCell: DraftCell = {
    passengerId: payload.passengerId,
    roundId: payload.roundId,
    busId: payload.busId,
    checkIn: false,
    checkOut: false,
    checkInNote: '',
    checkOutNote: '',
  };

  const merged: DraftCell = {
    ...defaultCell,
    ...baseCell,
    ...draftMap[key],
    ...payload,
  };

  const isDirty = !isSameCell(merged, baseCell);

  setDraftMap((prev) => ({
    ...prev,
    [key]: {
      ...merged,
      dirty: isDirty,
    },
  }));
};

  const isPresentAtRound = (passengerId: number, roundId: number, direction: 'checkIn' | 'checkOut') => {
    const cell = getCell(passengerId, roundId);
    return Boolean(cell?.[direction]);
  };

  const roundSummary = useMemo(() => {
    const summary: Record<number, { checkIn: number; checkOut: number; total: number }> = {};
    selectedRounds.forEach((round) => {
      const roundId = Number(round.id);
      const total = displayedPassengers.length;
      const checkIn = displayedPassengers.filter((p) => Boolean(getCell(p.id, roundId)?.checkIn)).length;
      const checkOut = displayedPassengers.filter((p) => Boolean(getCell(p.id, roundId)?.checkOut)).length;
      summary[roundId] = { checkIn, checkOut, total };
    });
    return summary;
  }, [displayedPassengers, selectedRounds, txMap, draftMap]);

  const visiblePassengers = useMemo(() => {
    return displayedPassengers.filter((p) => {
      if (departureRoundFilter && !isPresentAtRound(p.id, departureRoundFilter, 'checkIn')) {
        return false;
      }

      if (returnRoundFilter && !isPresentAtRound(p.id, returnRoundFilter, 'checkOut')) {
        return false;
      }

      return true;
    });
  }, [displayedPassengers, departureRoundFilter, returnRoundFilter, txMap, draftMap]);

  const tableHeaderSummary = useMemo(() => {
    const totalPassengers = visiblePassengers.length;
    const totalCheckIn = selectedRounds.reduce(
      (sum, round) => sum + (roundSummary[Number(round.id)]?.checkIn ?? 0),
      0
    );
    const totalCheckOut = selectedRounds.reduce(
      (sum, round) => sum + (roundSummary[Number(round.id)]?.checkOut ?? 0),
      0
    );

    return { totalPassengers, totalCheckIn, totalCheckOut };
  }, [displayedPassengers, selectedRounds, roundSummary]);

  const dirtyEntries = useMemo(
    () => Object.values(draftMap).filter((entry) => !isSameCell(entry, txMap[keyOf(entry.passengerId, entry.roundId)])),
    [draftMap, txMap]
  );

  const { isSaving, isOnline, syncBanner, hasPendingSync, handleSave } = useTransactionSync({
    dirtyEntries,
    selectedTripId,
    storageKey,
  });

  useRegisterUnsavedChanges(dirtyEntries.length > 0);

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  const handleConfirmAllExtraPassengers = async () => {
    if (extraPassengers.length === 0 || !selectedTripId) return;
    
    try {
    
      const savePromises = extraPassengers.flatMap((passenger) => 
        selectedRoundIds.map((roundId) => 
          api.createTransaction({
            passengerId: passenger.id,
            roundId: roundId,
            busId: passenger.busId!,
            checkIn: false,
            checkOut: false,
            checkInNote: null,
            checkOutNote: null,
          })
        )
      );
      await Promise.all(savePromises);
      enqueueSnackbar('Đã thêm khách ngoài biên chế vào bảng', { variant: 'success' });
      await Promise.all([refetchTransactions(), refetchPassengers()]);
      setExtraPassengers([]);
      setShowAddPassengerPanel(false);
    }catch(error: any) {
      enqueueSnackbar(error?.message ||'Có lỗi xảy ra khi thêm khách ngoài biên chế', { variant: 'error' });
    } 
  };
  return (
    <div className="animate-fade-in p-0 p-md-3 transaction-page pb-5">
      
          <TransactionHeader isOnline={isOnline} hasPendingSync={hasPendingSync}>
            <button 
              className="btn-refresh-custom shadow-sm" 
              onClick={() => { refetchTransactions(); refetchPassengers(); }}
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
            >
              <RefreshCw size={18} />
            </button>
            <ExportExcelButton
              visiblePassengers={visiblePassengers}
              selectedRounds={selectedRounds}
              trips={trips}
              selectedTripId={selectedTripId}
              getCell={getCell}
            />
            
            <button 
                className="btn-custom-action-save shadow-sm" 
                onClick={handleSave} 
              disabled={isSaving || !dirtyEntries.length}
                style={{ 
                backgroundColor: dirtyEntries.length > 0 ? colors.success : colors.surfaceLight,
                color: dirtyEntries.length > 0 ? '#fff' : colors.textMuted
                }}
            >
                <Save size={18} />
              <span className="d-none d-sm-inline">Lưu ({dirtyEntries.length})</span>
            </button>
        </TransactionHeader>

        <SyncStatusBanner syncBanner={syncBanner} />


      {/* Filters Toolbar - Đã gọn hóa */}
      <div 
        className="p-3 mb-4 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div ref={filterDropdownRef}>
        <TransactionFilters
            trips={trips} 
            buses={buses} 
            rounds={rounds}
            selectedTripId={selectedTripId} 
            selectedBusIds={selectedBusIds} 
            selectedRoundIds={selectedRoundIds}
            tripDropdownOpen={tripDropdownOpen}
            busDropdownOpen={busDropdownOpen} 
            roundDropdownOpen={roundDropdownOpen}
            setSelectedTripId={setSelectedTripId} 
            setTripDropdownOpen={setTripDropdownOpen}
            setBusDropdownOpen={setBusDropdownOpen} 
            setRoundDropdownOpen={setRoundDropdownOpen}
            toggleBus={(id) => setSelectedBusIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            toggleRound={(id) => setSelectedRoundIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onTripChange={() => setDraftMap({})}
          />
        </div>
        
        <div className="mt-3 pt-3 border-top d-flex flex-column gap-3" style={{ borderColor: colors.border }}>
            <div className="d-flex flex-wrap align-items-center gap-3">
              
              <button 
                className="btn-outline-custom flex-grow-1 flex-md-grow-0" 
                onClick={() => setShowAddPassengerPanel(!showAddPassengerPanel)}
                style={{ 
                  border: `1px solid ${colors.primary}44`, 
                  color: colors.primary,
                  padding: '8px 16px',
                  minWidth: '200px' 
                }}
              >
                <UserPlus size={16} /> <span className="ms-1">Khách ngoài biên chế</span>
              </button>

              <div className="d-flex flex-grow-1 gap-2 justify-content-between">
                
                <div className="d-flex align-items-center gap-2 flex-grow-1">
                  <label className="text-nowrap small fw-bold mb-0" style={{ color: colors.textSecondary }}>
                    Lượt đi:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={departureRoundFilter ?? ''} 
                    onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}
                    style={{ 
                      backgroundColor: isDarkMode ? colors.background : '#fff', 
                      color: colors.textPrimary, 
                      border: `1px solid ${colors.border}`,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      width: '100%' 
                    }}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="d-flex align-items-center gap-2 flex-grow-1">
                  <label className="text-nowrap small fw-bold mb-0" style={{ color: colors.textSecondary }}>
                    Lượt về:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={returnRoundFilter ?? ''} 
                    onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}
                    style={{ 
                      backgroundColor: isDarkMode ? colors.background : '#fff', 
                      color: colors.textPrimary, 
                      border: `1px solid ${colors.border}`,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      width: '100%'
                    }}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                
              </div>
            </div>
           <ExtraPassengerPanel
              show={showAddPassengerPanel}
              passengers={passengers}
              buses={buses}
              selectedBusIds={selectedBusIds}
              existingPassengerIds={existingPassengerIds}
              extraPassengers={extraPassengers}
              onAdd={addExtraPassenger}
              onRemove={removeExtraPassenger}
              onConfirmAll={handleConfirmAllExtraPassengers}
              onClose={() => setShowAddPassengerPanel(false)}
            />
              
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable<TransactionTableRow>
          title="Danh sách điểm danh"
          titleActions={
          <div className="d-flex flex-wrap align-items-center gap-2 gap-lg-3">
            <span className="badge rounded-pill px-3 py-2 fw-bold" 
                  style={{ backgroundColor: `${colors.primary}15`, color: colors.primary, border: `1px solid ${colors.primary}33` }}>
              {tableHeaderSummary.totalPassengers} khách
            </span>
            <div className="d-flex align-items-center gap-2 small fw-bold" style={{ color: colors.textSecondary }}>
              <span className="text-success text-nowrap">
                {tableHeaderSummary.totalCheckIn} <span className="d-none d-sm-inline">CÓ MẶT</span> LƯỢT ĐI
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span className="text-warning text-nowrap">
                {tableHeaderSummary.totalCheckOut} <span className="d-none d-sm-inline">KHÁCH</span> LƯỢT VỀ
              </span>
            </div>
          </div>
        }
          queryKey={['transaction-table', selectedTripId, selectedBusIds.join(','), selectedRoundIds.join(','), departureRoundFilter, returnRoundFilter]}
          data={visiblePassengers}
          columns={buildTransactionColumns({
            selectedRounds,
            roundSummary,
            getCell,
            setCell,
            isLocked,
            onRemovePassenger: handleRemovePassengerFromTransaction,
            canRemovePassenger,
          })}
          isLoading={isLoading}
          onRefresh={() => { refetchTransactions(); refetchPassengers(); refetchLocks(); }}
        />
        <ConfirmRoundPanel 
            selectedRounds={selectedRounds} 
            selectedBusIds={selectedBusIds} 
            onSuccess={() => { refetchTransactions(); refetchLocks(); }} 
        />
      </div>
      

      <style>{`
        .transaction-page .td-content input, 
        .transaction-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .transaction-page .td-content input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#475569'} !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 12px !important;
          border-bottom: 1px solid ${colors.border} !important;
          font-weight: 700 !important;
        }

        /* Nút bấm & Select Gọn */
        .btn-custom-action-save, .btn-outline-custom {
          display: flex; align-items: center; gap: 8px; padding: 0 16px;
          height: 38px; font-size: 13px; font-weight: 600; border-radius: 8px; border: none; transition: all 0.2s;
        }
        .btn-outline-custom { background: transparent; }
        .btn-outline-custom:hover { background: ${colors.primary}11; transform: translateY(-1px); }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .form-select-custom-toolbar {
          height: 38px; padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 500; outline: none;
        }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s; border: none; cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default TransactionPage;
