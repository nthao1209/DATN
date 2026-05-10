import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, ClipboardCheck, RefreshCw, UserPlus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
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

const TransactionPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
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
  const [extraSearchTerm, setExtraSearchTerm] = useState('');
  const [extraBusId, setExtraBusId] = useState<number | null>(null);
  
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
    if (!selectedBusIds.length) {
      setExtraBusId(null);
      return;
    }

    setExtraBusId((prev) => (prev && selectedBusIds.includes(prev) ? prev : selectedBusIds[0]));
  }, [selectedBusIds]);

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
        passengerId,
        roundId,
        busId,
        checkIn: Boolean(tx.checkIn),
        checkOut: Boolean(tx.checkOut),
        checkInAt: tx.checkInAt || null,
        checkInBy: tx.checkInBy ?? null,
        checkOutAt: tx.checkOutAt || null,
        checkOutBy: tx.checkOutBy ?? null,
        note: tx.note || '',
      };
    });
    return map;
  }, [transactions]);

  const normalizeNote = (note?: string) => (note ?? '').trim();

  const isSameCell = (current: DraftCell, base?: DraftCell) => {
    if (!base) {
      return current.checkIn === false && current.checkOut === false && normalizeNote(current.note) === '';
    }

    return (
      current.checkIn === Boolean(base.checkIn) &&
      current.checkOut === Boolean(base.checkOut) &&
      normalizeNote(current.note) === normalizeNote(base.note) &&
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

  const extraPassengerCandidates = useMemo(() => {
    if (!passengers.length || !selectedBusIds.length) return [];
    const normalizedSearch = extraSearchTerm.trim().toLowerCase();
    const existingIds = new Set<number>([...busFilteredPassengers, ...transactionBackedPassengers, ...extraPassengers].map((p) => p.id));

    return passengers
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name || '',
        tel: p.tel || '',
        assignedBusId: p.bus?.id ? Number(p.bus.id) : null,
        assignedBusName: p.bus?.busCode || p.bus?.registrationNumber || '',
        assignedBusCode: p.bus?.busCode || '',
        assignedBusPlate: p.bus?.registrationNumber || '',
      }))
      .filter((p) => !existingIds.has(p.id))
      .filter((p) => !p.assignedBusId || !selectedBusIds.includes(p.assignedBusId))
      .filter((p) => {
        if (!normalizedSearch) return true;
        return p.name.toLowerCase().includes(normalizedSearch) || p.tel.includes(normalizedSearch);
      });
  }, [busFilteredPassengers, extraPassengers, extraSearchTerm, passengers, selectedBusIds, transactionBackedPassengers]);

  const extraCandidateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    extraPassengerCandidates.forEach((candidate) => {
      const key = candidate.name.trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [extraPassengerCandidates]);

  const addExtraPassenger = (candidate: { id: number; name: string; tel: string; assignedBusId: number | null; assignedBusName: string }) => {
    if (!extraBusId) return;
    const actualBus = buses.find((bus) => Number(bus.id) === extraBusId);
    const actualBusName = actualBus?.busCode || actualBus?.registrationNumber || '';

    setExtraPassengers((prev) => {
      if (prev.some((p) => p.id === candidate.id)) return prev;
      return [
        ...prev,
        {
          id: candidate.id,
          name: candidate.name,
          tel: candidate.tel,
          busId: extraBusId,
          busName: actualBusName,
          assignedBusName: candidate.assignedBusName,
        },
      ];
    });
  };

  const removeExtraPassenger = (passengerId: number) => {
    setExtraPassengers((prev) => prev.filter((p) => p.id !== passengerId));
  };

 

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
    const baseCell = txMap[keyOf(payload.passengerId, payload.roundId)];
    const isDirty = !isSameCell(payload, baseCell);
    setDraftMap((prev) => ({
      ...prev,
      [keyOf(payload.passengerId, payload.roundId)]: { ...payload, dirty: isDirty },
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

  const handleExportExcel = () => {
    if (!visiblePassengers.length) {
      enqueueSnackbar('Không có dữ liệu để export', { variant: 'warning' });
      return;
    }

    try {
      const selectedTrip = trips.find((trip) => Number(trip.id) === Number(selectedTripId));
      const tripName = selectedTrip?.name || `trip_${selectedTripId ?? 'unknown'}`;

      const exportRows = visiblePassengers.map((passenger, index) => {
        const baseRow: Record<string, string | number> = {
          STT: index + 1,
          'Họ và tên': passenger.name || '',
          'Số điện thoại': passenger.tel || '',
          'Xe điểm danh': passenger.busName || '',
          'Xe biên chế': passenger.assignedBusName || '',
        };

        selectedRounds.forEach((round) => {
          const roundId = Number(round.id);
          const roundLabel = round.name || `Lượt ${roundId}`;
          const cell = getCell(passenger.id, roundId);

          baseRow[`${roundLabel} - Lượt đi`] = cell?.checkIn ? 'Có' : 'Không';
          baseRow[`${roundLabel} - Lượt về`] = cell?.checkOut ? 'Có' : 'Không';
          baseRow[`${roundLabel} - Ghi chú`] = cell?.note?.trim() || '';
        });

        return baseRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 16 },
        { wch: 20 },
        { wch: 20 },
        ...selectedRounds.flatMap(() => [{ wch: 16 }, { wch: 16 }, { wch: 28 }]),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

      const safeTripName = tripName
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_');

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const fileName = `transactions_${safeTripName}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      enqueueSnackbar('Đã export file Excel thành công', { variant: 'success' });
    } catch (error) {
      console.error('Export transaction excel error:', error);
      enqueueSnackbar('Export Excel thất bại', { variant: 'error' });
    }
  };

  return (
    <div className="animate-fade-in p-0 p-md-3 transaction-page pb-5">
      
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
            style={{ 
                width: '42px', height: '42px', 
                backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
                border: `1px solid ${colors.primary}33`
            }}
          >
            <ClipboardCheck size={20} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Điểm danh</h1>
        </div>
        
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <span
              className="badge rounded-pill px-3 py-2 fw-semibold"
              style={{
                backgroundColor: isOnline ? `${colors.success}15` : `${colors.warning}15`,
                color: isOnline ? colors.success : colors.warning,
                border: `1px solid ${isOnline ? `${colors.success}33` : `${colors.warning}33`}`,
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {hasPendingSync && (
              <span
                className="badge rounded-pill px-3 py-2 fw-semibold"
                style={{
                  backgroundColor: `${colors.info}15`,
                  color: colors.info,
                  border: `1px solid ${colors.info}33`,
                }}
              >
                Có dữ liệu chờ đồng bộ
              </span>
            )}
            <button className="btn-refresh-custom shadow-sm" onClick={() => { refetchTransactions(); refetchPassengers(); }}
                    style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                <RefreshCw size={18} />
            </button>
            <button
              className="btn-custom-action-save shadow-sm"
              onClick={handleExportExcel}
              disabled={!visiblePassengers.length}
              style={{
                backgroundColor: visiblePassengers.length ? colors.info : colors.surfaceLight,
                color: visiblePassengers.length ? '#fff' : colors.textMuted,
              }}
            >
              <Download size={18} />
              <span className="d-none d-sm-inline">Export Excel</span>
            </button>
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
        </div>
      </div>

      {syncBanner && (
        <div className="mb-3 px-2">
          <div
            className="d-flex align-items-start gap-2 px-3 py-2 rounded-3"
            style={{
              backgroundColor:
                syncBanner.tone === 'success'
                  ? `${colors.success}15`
                  : syncBanner.tone === 'warning'
                    ? `${colors.warning}15`
                    : syncBanner.tone === 'danger'
                      ? `${colors.danger}15`
                      : `${colors.info}15`,
              border: `1px solid ${
                syncBanner.tone === 'success'
                  ? `${colors.success}33`
                  : syncBanner.tone === 'warning'
                    ? `${colors.warning}33`
                    : syncBanner.tone === 'danger'
                      ? `${colors.danger}33`
                      : `${colors.info}33`
              }`,
              color:
                syncBanner.tone === 'success'
                  ? colors.success
                  : syncBanner.tone === 'warning'
                    ? colors.warning
                    : syncBanner.tone === 'danger'
                      ? colors.danger
                      : colors.info,
            }}
          >
            <ClipboardCheck size={16} className="mt-0.5 flex-shrink-0" />
            <div className="small fw-semibold">{syncBanner.label}</div>
          </div>
        </div>
      )}

      {/* Filters Toolbar - Đã gọn hóa */}
      <div 
        className="p-3 mb-4 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <TransactionFilters
          trips={trips} buses={buses} rounds={rounds}
          selectedTripId={selectedTripId} selectedBusIds={selectedBusIds} selectedRoundIds={selectedRoundIds}
          busDropdownOpen={busDropdownOpen} roundDropdownOpen={roundDropdownOpen}
          setSelectedTripId={setSelectedTripId} setBusDropdownOpen={setBusDropdownOpen} setRoundDropdownOpen={setRoundDropdownOpen}
          toggleBus={(id) => setSelectedBusIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          toggleRound={(id) => setSelectedRoundIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onTripChange={() => setDraftMap({})}
        />
        
        <div className="mt-3 pt-3 border-top d-flex flex-column gap-3" style={{ borderColor: colors.border }}>
          <div className="d-flex flex-column flex-md-row gap-2">
            <button className="btn-outline-custom flex-grow-1" onClick={() => setShowAddPassengerPanel(!showAddPassengerPanel)}
                    style={{ border: `1px solid ${colors.primary}44`, color: colors.primary }}>
               <UserPlus size={16} /> <span>Khách ngoài biên chế</span>
            </button>
            <div className="d-flex gap-2 flex-grow-1">
                <select className="form-select-custom-toolbar w-100" value={departureRoundFilter ?? ''} 
                        onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}
                        style={{ backgroundColor: isDarkMode ? colors.background : '#fff', color: colors.textPrimary, border: `1px solid ${colors.border}` }}>
                  <option value="">Lượt đi: Tất cả</option>
                  {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select className="form-select-custom-toolbar w-100" value={returnRoundFilter ?? ''} 
                        onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}
                        style={{ backgroundColor: isDarkMode ? colors.background : '#fff', color: colors.textPrimary, border: `1px solid ${colors.border}` }}>
                  <option value="">Lượt về: Tất cả</option>
                  {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>
          </div>
          {showAddPassengerPanel && (
            <div className="p-3 rounded-3" style={{ border: `1px dashed ${colors.primary}44`, backgroundColor: `${colors.primary}08` }}>
              <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch">
                <input
                  className="form-control form-control-sm"
                  placeholder="Tìm theo tên hoặc SĐT"
                  value={extraSearchTerm}
                  onChange={(e) => setExtraSearchTerm(e.target.value)}
                />
                <select
                  className="form-select form-select-sm"
                  value={extraBusId ?? ''}
                  onChange={(e) => setExtraBusId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Chọn xe để điểm danh</option>
                  {selectedBusIds.map((id) => {
                    const bus = buses.find((b) => Number(b.id) === Number(id));
                    return (
                      <option key={id} value={id}>
                        {bus?.busCode || bus?.registrationNumber || `Xe ${id}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="mt-3" style={{ maxHeight: '220px', overflow: 'auto' }}>
                {extraPassengerCandidates.length === 0 ? (
                  <div className="text-muted small">Không có khách phù hợp.</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {extraPassengerCandidates.map((p) => (
                      <div key={p.id} className="d-flex align-items-center justify-content-between gap-2">
                        <div className="d-flex flex-column">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold" style={{ fontSize: '13px' }}>{p.name}</span>
                            {(extraCandidateNameCounts.get(p.name.trim().toLowerCase()) ?? 0) > 1 && (
                              <span className="badge rounded-pill" style={{ backgroundColor: `${colors.warning}22`, color: colors.warning, border: `1px solid ${colors.warning}55`, fontSize: '10px' }}>
                                Trùng tên
                              </span>
                            )}
                          </div>
                          <span className="text-muted" style={{ fontSize: '12px' }}>{p.tel || '-'}</span>
                          <span className="text-muted" style={{ fontSize: '12px' }}>
                            Biên chế: {p.assignedBusCode || 'N/A'}{p.assignedBusPlate ? ` · ${p.assignedBusPlate}` : ''}
                          </span>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          type="button"
                          disabled={!extraBusId}
                          onClick={() => addExtraPassenger(p)}
                        >
                          Thêm
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {extraPassengers.length > 0 && (
                <div className="mt-3">
                  <div className="small text-muted mb-2">Đã thêm</div>
                  <div className="d-flex flex-column gap-2">
                    {extraPassengers.map((p) => (
                      <div key={p.id} className="d-flex align-items-center justify-content-between">
                        <div className="d-flex flex-column">
                          <span className="fw-semibold" style={{ fontSize: '13px' }}>{p.name}</span>
                          <span className="text-muted" style={{ fontSize: '12px' }}>{p.tel || '-'} · Xe điểm danh: {p.busName || 'N/A'}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          type="button"
                          onClick={() => removeExtraPassenger(p.id)}
                        >
                          Bỏ
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable<TransactionTableRow>
          title="Danh sách điểm danh"
          titleActions={
            <div className="d-none d-lg-flex align-items-center gap-3">
              <span className="badge rounded-pill px-3 py-2 fw-bold" style={{ backgroundColor: `${colors.primary}15`, color: colors.primary, border: `1px solid ${colors.primary}33` }}>
                {tableHeaderSummary.totalPassengers} khách
              </span>
              <div className="d-flex align-items-center gap-2 small fw-bold" style={{ color: colors.textSecondary }}>
                <span className="text-success">{tableHeaderSummary.totalCheckIn} KHÁCH LƯỢT ĐI</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span className="text-warning">{tableHeaderSummary.totalCheckOut} KHÁCH LƯỢT VỀ</span>
              </div>
            </div>
          }
          queryKey={['transaction-table', selectedTripId, selectedBusIds.join(','), selectedRoundIds.join(','), departureRoundFilter, returnRoundFilter]}
          data={visiblePassengers}
          columns={buildTransactionColumns({ selectedRounds, roundSummary, getCell, setCell })}
          isLoading={isLoading}
          onRefresh={() => { refetchTransactions(); refetchPassengers(); }}
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
