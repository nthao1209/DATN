import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, ClipboardCheck, RefreshCw, UserPlus } from 'lucide-react';
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

const TransactionPage: React.FC = () => {
  const { colors } = useTheme();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [departureRoundFilter, setDepartureRoundFilter] = useState<number | null>(null);
  const [returnRoundFilter, setReturnRoundFilter] = useState<number | null>(null);
  const [showAddPassengerPanel, setShowAddPassengerPanel] = useState(false);
  const [extraPassengers, setExtraPassengers] = useState<PassengerRow[]>([]);
  
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
    queryFn: () => api.getPassengers(String(selectedTripId)),
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
      setSelectedBusIds([]);
      return;
    }

    setSelectedBusIds((prev) => {
      if (!prev.length) return buses.map((b) => Number(b.id));
      const valid = prev.filter((id) => buses.some((b) => Number(b.id) === id));
      return valid.length ? valid : buses.map((b) => Number(b.id));
    });
  }, [buses]);

  useEffect(() => {
    if (!rounds.length) {
      setSelectedRoundIds([]);
      return;
    }

    setSelectedRoundIds((prev) => {
      if (!prev.length) return rounds.map((r) => Number(r.id));
      const valid = prev.filter((id) => rounds.some((r) => Number(r.id) === id));
      return valid.length ? valid : rounds.map((r) => Number(r.id));
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
      const parsed = JSON.parse(raw) as Record<string, DraftCell>;
      setDraftMap(parsed || {});
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
      const busId = Number(tx.busId ?? tx.bus?.id ?? tx.passenger?.busId ?? 0);
      if (!passengerId || !roundId || !busId) return;
      map[keyOf(passengerId, roundId)] = {
        transactionId: Number(tx.id),
        updatedAt: tx.updatedAt,
        passengerId,
        roundId,
        busId,
        checkIn: Boolean(tx.checkIn),
        checkOut: Boolean(tx.checkOut),
        note: tx.note || '',
      };
    });
    return map;
  }, [transactions]);


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

    transactions.forEach((tx) => {
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const actualBusId = Number(tx.busId ?? tx.bus?.id ?? 0);
      const assignedBusId = Number(tx.passenger?.busId ?? tx.passenger?.bus?.id ?? 0);
      if (!passengerId || !actualBusId) return;

      const isInActualBusFilter = selectedBusIds.includes(actualBusId);
      const isInAssignedBusFilter = assignedBusId ? selectedBusIds.includes(assignedBusId) : false;
      if (!isInActualBusFilter && !isInAssignedBusFilter) return;

      if (passengersById.has(passengerId)) return;

      const assignedFromPassengerList = passengers.find((p: any) => Number(p.id) === passengerId);
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

  const displayedPassengers = useMemo<PassengerRow[]>(() => {
    const map = new Map<number, PassengerRow>();
    busFilteredPassengers.forEach((p) => map.set(p.id, p));
    transactionBackedPassengers.forEach((p) => map.set(p.id, p));
    extraPassengers.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [busFilteredPassengers, transactionBackedPassengers, extraPassengers]);

  
  const selectedRounds = useMemo(
    () => rounds.filter((r) => selectedRoundIds.includes(Number(r.id))),
    [rounds, selectedRoundIds]
  );

  const getCell = (passengerId: number, roundId: number): DraftCell | null => {
    const key = keyOf(passengerId, roundId);
    return draftMap[key] || txMap[key] || null;
  };

  const setCell = (payload: DraftCell) => {
    setDraftMap((prev) => ({
      ...prev,
      [keyOf(payload.passengerId, payload.roundId)]: { ...payload, dirty: true },
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
    const totalPassengers = displayedPassengers.length;
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

  const tableData = useMemo<TransactionTableRow[]>(() => {
    return [...visiblePassengers];
  }, [visiblePassengers]);

  const tableColumns = useMemo(
    () =>
      buildTransactionColumns({
        selectedRounds,
        roundSummary,
        getCell,
        setCell,
      }),
    [selectedRounds, roundSummary, txMap, draftMap]
  );

  

  const dirtyEntries = useMemo(
    () => Object.values(draftMap).filter((entry) => entry.dirty),
    [draftMap]
  );

  const { isSaving, handleSave } = useTransactionSync({
    dirtyEntries,
    selectedTripId,
    storageKey,
  });

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  return (
    <>
      <div className="transaction-page p-0 p-md-3 animate-fade-in mb-5"> {/* Thêm mb-5 để không bị cái summary che mất dòng cuối bảng */}
        
        {/* Header & Main Actions - FIX tràn chữ trên Mobile */}
        <div className="d-flex align-items-center justify-content-between mb-3 px-3 mt-3">
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <div className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle" 
                 style={{ width: '38px', height: '38px', backgroundColor: colors.primaryGlow }}>
              <ClipboardCheck size={20} style={{ color: colors.primary }} />
            </div>
            <h1 className="h5 fw-bold text-white m-0 text-truncate">Điểm danh</h1>
          </div>
          <div className="d-flex gap-2 flex-shrink-0">
             <button className="btn-icon-custom" onClick={() => { refetchTransactions(); refetchPassengers(); }}>
                <RefreshCw size={18} color="white" />
             </button>
             <button 
                className="btn-custom-action" 
                onClick={handleSave} 
                disabled={isSaving || !dirtyEntries.length}
                style={{ backgroundColor: dirtyEntries.length > 0 ? colors.success : colors.surfaceLight, padding: '0 12px' }}
             >
                <Save size={18} />
                <span className="d-none d-sm-inline">Lưu ({dirtyEntries.length})</span>
             </button>
          </div>
        </div>

        {/* Filters Toolbar - FIX layout button Khách ngoài biên chế */}
        <div className="px-3 mb-4">
          <div className="toolbar-glass p-3">
            <TransactionFilters
              trips={trips} buses={buses} rounds={rounds}
              selectedTripId={selectedTripId} selectedBusIds={selectedBusIds} selectedRoundIds={selectedRoundIds}
              busDropdownOpen={busDropdownOpen} roundDropdownOpen={roundDropdownOpen}
              setSelectedTripId={setSelectedTripId} setBusDropdownOpen={setBusDropdownOpen} setRoundDropdownOpen={setRoundDropdownOpen}
              toggleBus={(id) => setSelectedBusIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              toggleRound={(id) => setSelectedRoundIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              onTripChange={() => setDraftMap({})}
            />
            
            <div className="mt-3 pt-3 border-top d-flex flex-column gap-2" style={{ borderColor: `${colors.border}44` }}>
              <button className="btn-outline-custom w-100" onClick={() => setShowAddPassengerPanel(!showAddPassengerPanel)}
                      style={{ minHeight: '44px' }}> {/* Tăng height để không bị tràn chữ */}
                 <UserPlus size={16} /> <span style={{ fontSize: '13px' }}>Khách ngoài biên chế</span>
              </button>
              <div className="row g-2">
                <div className="col-6">
                   <select className="form-select-custom w-100" value={departureRoundFilter ?? ''} onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Lượt đi: Tất cả</option>
                      {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
                </div>
                <div className="col-6">
                   <select className="form-select-custom w-100" value={returnRoundFilter ?? ''} onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Lượt về: Tất cả</option>
                      {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="position-relative pb-5"> {/* Thêm padding bottom lớn để không bị summary che */}
          <DataTable<TransactionTableRow>
            title="Danh sách điểm danh"
            titleActions={
              <div className="d-none d-lg-flex align-items-center gap-2 flex-wrap justify-content-end">
                <span
                  className="badge rounded-pill px-3 py-2 fw-semibold"
                  style={{
                    backgroundColor: colors.primaryGlow,
                    color: colors.primary,
                    border: `1px solid ${colors.primary}55`,
                  }}
                >
                  {tableHeaderSummary.totalPassengers} khách
                </span>
                <span className="small fw-semibold" style={{ color: colors.textMuted }}>
                  |
                </span>
                <span className="small fw-semibold text-white">
                  {tableHeaderSummary.totalCheckIn} CÓ MẶT LƯỢT ĐI
                </span>
                <span className="small fw-semibold" style={{ color: colors.textMuted }}>
                  -
                </span>
                <span className="small fw-semibold text-white">
                  {tableHeaderSummary.totalCheckOut} CÓ MẶT LƯỢT VỀ
                </span>
              </div>
            }
            queryKey={[
            'transaction-table',
            selectedTripId,
            selectedBusIds.join(','),
            selectedRoundIds.join(','),
            departureRoundFilter,
            returnRoundFilter,
            dirtyEntries.length,
          ]}
            data={tableData}
            columns={tableColumns}
            isLoading={isLoading}
            onRefresh={() => { refetchTransactions(); refetchPassengers(); }}
          />
        </div>

        <style>{`
          .toolbar-glass { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border-radius: 16px; border: 1px solid ${colors.border}; }
          .btn-custom-action { display: flex; align-items: center; gap: 8px; height: 40px; color: white; font-weight: 700; border-radius: 10px; border: none; }
          .btn-icon-custom { width: 40px; height: 40px; border-radius: 10px; border: 1px solid ${colors.border}; background: ${colors.surfaceLight}; color: ${colors.textSecondary}; display: flex; align-items: center; justify-content: center; }
          .btn-outline-custom { background: transparent; border: 1px solid ${colors.primary}55; color: ${colors.primary}; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; }
          .form-select-custom { background: ${colors.background}; color: ${colors.textPrimary}; border: 1px solid ${colors.border}; height: 40px; border-radius: 10px; padding: 0 8px; font-size: 12px; outline: none; }
          
          /* Animation quay */
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

      </div>
  </>
  );
};

export default TransactionPage;
