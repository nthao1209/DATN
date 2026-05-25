import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, RefreshCw, UserPlus} from 'lucide-react';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { subscribeAttendanceUpdates } from '../../services/mqtt';
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
import useDebounce from '../../hooks/useDebounce';
import { useTheme } from '../../theme/ThemeContext';
import { OFFLINE_QUEUE_SYNCED_EVENT } from '../../services/offlineSync';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { useSnackbar } from 'notistack';
import ExtraPassengerPanel from './transaction/ExtraPassengerPanel';  
import ExportExcelButton from './transaction/ExportExcelButton';
import TransactionHeader from './transaction/TransactionHeader';
import ConfirmRoundPanel from './transaction/ConfirmRoundPanel';
import SyncStatusBanner from './transaction/SyncStatusBanner';
import { useRoundLocks } from '../../hooks/useRoundLocks';
import CompleteRoundPanel from './transaction/CompleteRoundPanel';
import { type BusRoundStatus } from './transaction/types';
import './TransactionPage.css';


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
  const pageThemeVars = {
      '--page-primary': colors.primary,
      '--page-primary-11': `${colors.primary}11`,
      '--page-primary-22': `${colors.primary}22`,
      '--page-surface-light': colors.surfaceLight,
      '--page-background': colors.background,
      '--page-border': colors.border,
      '--page-border-light': colors.borderLight,
      '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
      '--page-table-header-text': isDarkMode ? colors.textSecondary : '#475569',
    };

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
  const {
      data: busRoundStatuses = [],
      refetch: refetchBusRoundStatuses,
    } = useQuery<BusRoundStatus[]>({
      queryKey: ['transaction-bus-round-statuses', selectedTripId],
      queryFn: async () => {
        const response = await api.getBusRoundStatuses(String(selectedTripId));
        const data = Array.isArray(response)
          ? response
          : Array.isArray((response as any)?.data)
            ? (response as any).data
            : [];

        return data as BusRoundStatus[];
      },
      enabled: !!selectedTripId,
    });


    const getActualBusId = (
      passengerId: number,
      roundId: number,
      assignedBusId?: number | null
    ) => {
      const key = keyOf(passengerId, roundId);

      const txCell = txMap[key];

      if (txCell?.busId) {
        return Number(txCell.busId);
      }
      if (assignedBusId) {
        return Number(assignedBusId);
      }

      return null;
    };
    
  const { isLocked, lockStatuses, refetchLocks } = useRoundLocks(
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
        assignedBusId: p.bus?.id ? Number(p.bus.id) : null,
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
        assignedBusId: assignedFromPassengerList?.bus?.id
          ? Number(assignedFromPassengerList.bus.id)
          : assignedBusId || null,
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

  const assignedBusByPassengerId = useMemo(() => {
    const map = new Map<number, number | null>();

    displayedPassengers.forEach((p) => {
      map.set(Number(p.id), p.assignedBusId ?? null);
    });

    return map;
  }, [displayedPassengers]);

  
  const selectedRounds = useMemo(
    () => rounds.filter((r) => selectedRoundIds.includes(Number(r.id))),
    [rounds, selectedRoundIds]
  );

  const extraPassengerTargetBusId = selectedBusIds.length === 1 ? Number(selectedBusIds[0]) : selectedBusIds[0] ?? null;

  const extraPassengerRoundLocked = useMemo(() => {
    if (!extraPassengerTargetBusId || !selectedRounds.length) {
      return false;
    }

    return selectedRounds.some((round) => {
      const status = busRoundStatuses.find(
        (item) =>
          Number(item.busId) === Number(extraPassengerTargetBusId) &&
          Number(item.roundId) === Number(round.id)
      );

      return Boolean(status?.driverConfirmedBy);
    });
  }, [busRoundStatuses, extraPassengerTargetBusId, selectedRounds]);

  const getCell = (passengerId: number, roundId: number): DraftCell | null => {
    const key = keyOf(passengerId, roundId);
    return draftMap[key] || txMap[key] || null;
  };

  const buildLockedAttendanceMessage = (params: {
    lockedIn: boolean;
    lockedOut: boolean;
    changingCheckIn: boolean;
    changingCheckInNote: boolean;
    changingCheckOut: boolean;
    changingCheckOutNote: boolean;
  }) => {
    const messages: string[] = [];

    if (params.lockedIn && (params.changingCheckIn || params.changingCheckInNote)) {
      messages.push('Lượt đi đã khóa nên không sửa được check-in/ghi chú.');
    }

    if (params.lockedOut && (params.changingCheckOut || params.changingCheckOutNote)) {
      messages.push('Lượt về đã khóa nên không sửa được check-out/ghi chú.');
    }

    return messages.length ? messages.join(' ') : 'Lượt đã bị khóa, không thể chỉnh sửa.';
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

        const changingCheckIn =
          payload.checkIn !== undefined &&
          payload.checkIn !== baseCell?.checkIn;
        
        const changingCheckInNote =
          payload.checkInNote !== undefined &&
          payload.checkInNote !== baseCell?.checkInNote;

        const changingCheckOut =
          payload.checkOut !== undefined &&
          payload.checkOut !== baseCell?.checkOut;

        const changingCheckOutNote =
          payload.checkOutNote !== undefined &&
          payload.checkOutNote !== baseCell?.checkOutNote;

        if (
          (lockedIn && (changingCheckIn || changingCheckInNote)) ||
          (lockedOut && (changingCheckOut || changingCheckOutNote))
        ) {
          enqueueSnackbar(
            buildLockedAttendanceMessage({
              lockedIn,
              lockedOut,
              changingCheckIn,
              changingCheckInNote,
              changingCheckOut,
              changingCheckOutNote,
            }),
            { variant: 'warning' }
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
    const summary: Record<
      number,
      {
        checkIn: number;
        checkOut: number;
        total: number;
        checkInMatched: number;
        checkInMismatched: number;
        checkOutMatched: number;
        checkOutMismatched: number;
      }
    > = {};
    selectedRounds.forEach((round) => {
      const roundId = Number(round.id);
      const total = displayedPassengers.length;
      let checkIn = 0;
      let checkOut = 0;
      let checkInMatched = 0;
      let checkInMismatched = 0;
      let checkOutMatched = 0;
      let checkOutMismatched = 0;

      displayedPassengers.forEach((passenger) => {
        const cell = getCell(passenger.id, roundId);
        const assignedBusId = assignedBusByPassengerId.get(passenger.id);

        if (cell?.checkIn) {
          checkIn += 1;
          if (assignedBusId && Number(cell.busId) !== Number(assignedBusId)) {
            checkInMismatched += 1;
          } else {
            checkInMatched += 1;
          }
        }

        if (cell?.checkOut) {
          checkOut += 1;
          if (assignedBusId && Number(cell.busId) !== Number(assignedBusId)) {
            checkOutMismatched += 1;
          } else {
            checkOutMatched += 1;
          }
        }
      });

      summary[roundId] = {
        checkIn,
        checkOut,
        total,
        checkInMatched,
        checkInMismatched,
        checkOutMatched,
        checkOutMismatched,
      };
    });
    return summary;
  }, [assignedBusByPassengerId, displayedPassengers, selectedRounds, txMap, draftMap]);

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
    const totalCheckInMismatched = selectedRounds.reduce(
      (sum, round) => sum + (roundSummary[Number(round.id)]?.checkInMismatched ?? 0),
      0
    );
    const totalCheckOut = selectedRounds.reduce(
      (sum, round) => sum + (roundSummary[Number(round.id)]?.checkOut ?? 0),
      0
    );
    const totalCheckOutMismatched = selectedRounds.reduce(
      (sum, round) => sum + (roundSummary[Number(round.id)]?.checkOutMismatched ?? 0),
      0
    );

    return {
      totalPassengers,
      totalCheckIn,
      totalCheckInMismatched,
      totalCheckOut,
      totalCheckOutMismatched,
    };
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

    if (extraPassengerRoundLocked) {
      enqueueSnackbar('Chặng đã  khóa, không thể thêm khách ngoài biên chế.', { variant: 'warning' });
      return;
    }
    
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
    <div className="animate-fade-in p-0 p-md-3 transaction-page pb-5" style={pageThemeVars as React.CSSProperties}>
      
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
              buses={buses}
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
              confirmDisabled={extraPassengerRoundLocked}
              confirmDisabledReason="Chặng đã khóa nên không thể thêm khách ngoài biên chế."
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
              <span className="text-danger text-nowrap">
                {tableHeaderSummary.totalCheckInMismatched} <span className="d-none d-sm-inline">SAI XE</span>
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span className="text-warning text-nowrap">
                {tableHeaderSummary.totalCheckOut} <span className="d-none d-sm-inline">KHÁCH</span> LƯỢT VỀ
              </span>
              <span className="text-danger text-nowrap">
                {tableHeaderSummary.totalCheckOutMismatched} <span className="d-none d-sm-inline">SAI XE</span>
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
      <div className="bento-action-hub shadow-sm" 
           style={{ 
            backgroundColor: isDarkMode ? 'rgba(20, 27, 49, 0.4)' : '#f8fafc',
            border: `1px solid ${colors.border}`, 
            borderRadius: effects.borderRadius.lg }}>
        <div className="d-flex flex-column gap-2">
        <ConfirmRoundPanel 
            selectedRounds={selectedRounds} 
            selectedBusIds={selectedBusIds} 
          lockStatuses={lockStatuses} 
            onSuccess={() => { refetchTransactions(); refetchLocks(); }} 
        />
        <CompleteRoundPanel
            selectedRounds={selectedRounds}
            selectedBusIds={selectedBusIds}
            busRoundStatuses={busRoundStatuses}
            onSuccess={() => { refetchTransactions(); refetchLocks(); refetchBusRoundStatuses(); }}
          />
        </div>
      </div>
      </div>
    </div>
  );
};

export default TransactionPage;