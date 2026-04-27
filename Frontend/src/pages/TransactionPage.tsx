import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, ClipboardCheck, RefreshCw, Plus, Search, X } from 'lucide-react';
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
import './transaction/TransactionPage.css';

const TransactionPage: React.FC = () => {
  const { colors } = useTheme();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [departureRoundFilter, setDepartureRoundFilter] = useState<number | null>(null);
  const [returnRoundFilter, setReturnRoundFilter] = useState<number | null>(null);
  const [showAddPassengerPanel, setShowAddPassengerPanel] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedSearchPassengerId, setSelectedSearchPassengerId] = useState<number | null>(null);
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
    data: searchPassengers = [],
    isLoading: searchPassengersLoading,
  } = useQuery<any[]>({
    queryKey: ['attendance-search-passengers', selectedTripId, searchKeyword],
    queryFn: () => api.searchPassengersByNameForAttendance(String(selectedTripId), searchKeyword),
    enabled: !!selectedTripId && showAddPassengerPanel && searchKeyword.trim().length >= 1,
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
    setSearchKeyword('');
    setSelectedSearchPassengerId(null);
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

  const nameFilteredPassengers = useMemo(() => {
    const keyword = nameFilter.trim().toLowerCase();
    if (!keyword) return displayedPassengers;
    return displayedPassengers.filter((p) => p.name.toLowerCase().includes(keyword));
  }, [displayedPassengers, nameFilter]);

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
      const total = nameFilteredPassengers.length;
      const checkIn = nameFilteredPassengers.filter((p) => Boolean(getCell(p.id, roundId)?.checkIn)).length;
      const checkOut = nameFilteredPassengers.filter((p) => Boolean(getCell(p.id, roundId)?.checkOut)).length;
      summary[roundId] = { checkIn, checkOut, total };
    });
    return summary;
  }, [nameFilteredPassengers, selectedRounds, txMap, draftMap]);

  const visiblePassengers = useMemo(() => {
    return nameFilteredPassengers.filter((p) => {
      if (departureRoundFilter && !isPresentAtRound(p.id, departureRoundFilter, 'checkIn')) {
        return false;
      }

      if (returnRoundFilter && !isPresentAtRound(p.id, returnRoundFilter, 'checkOut')) {
        return false;
      }

      return true;
    });
  }, [nameFilteredPassengers, departureRoundFilter, returnRoundFilter, txMap, draftMap]);

  const tableRows = useMemo<TransactionTableRow[]>(() => {
    const rows: TransactionTableRow[] = [...visiblePassengers];
    rows.push({
      id: -1,
      name: 'Tổng điểm danh',
      tel: '',
      busId: null,
      busName: '',
      isSummary: true,
    });
    return rows;
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

  const toggleBus = (busId: number) => {
    setSelectedBusIds((prev) =>
      prev.includes(busId) ? prev.filter((id) => id !== busId) : [...prev, busId]
    );
  };

  const toggleRound = (roundId: number) => {
    setSelectedRoundIds((prev) =>
      prev.includes(roundId) ? prev.filter((id) => id !== roundId) : [...prev, roundId]
    );
  };

  const dirtyEntries = useMemo(
    () => Object.values(draftMap).filter((entry) => entry.dirty),
    [draftMap]
  );

  const { isSaving, isOnline, hasPendingSync, handleSave } = useTransactionSync({
    dirtyEntries,
    selectedTripId,
    storageKey,
    setDraftMap,
    refetchTransactions,
    refetchPassengers,
  });

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  return (
    <div
      className="transaction-page p-2 p-md-3"
      style={{
        ['--tx-page-bg' as string]: colors.background,
        ['--tx-toolbar-bg' as string]: colors.surface,
        ['--tx-toolbar-border' as string]: colors.border,
        ['--tx-soft-bg' as string]: colors.surface,
        ['--tx-soft-border' as string]: colors.border,
        ['--tx-table-cell-bg' as string]: colors.surface,
        ['--tx-table-cell-color' as string]: colors.textPrimary,
        ['--tx-table-cell-border' as string]: colors.border,
        ['--tx-table-head-color' as string]: colors.textSecondary,
        ['--tx-table-head-bg' as string]: colors.surfaceLight,
        ['--tx-table-row-hover' as string]: colors.surfaceLight,
        ['--tx-title-color' as string]: colors.info,
        ['--tx-search-list-bg' as string]: colors.surfaceLight,
        ['--tx-search-list-border' as string]: colors.border,
        ['--tx-hover-soft' as string]: colors.surface,
        ['--tx-contact-phone' as string]: colors.textSecondary,
        ['--tx-success-bg' as string]: colors.success,
        ['--tx-success-bg-hover' as string]: colors.success,
      } as React.CSSProperties}
    >
      <div className="transaction-toolbar mb-3">
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <h4 className="transaction-title m-0 fw-bold d-flex align-items-center gap-2">
            <ClipboardCheck size={20}  /> Điểm danh hành khách
          </h4>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {!isOnline && <span className="badge text-bg-warning">Offline: đang lưu tạm local</span>}
            {isOnline && hasPendingSync && <span className="badge text-bg-info">Có dữ liệu chờ đồng bộ</span>}
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                if (selectedBusIds.length !== 1) {
                  alert('Vui lòng chỉ chọn 1 xe để thêm khách ngoài biên chế.');
                  return;
                }
                setShowAddPassengerPanel((prev) => !prev);
              }}
            >
              <Plus size={14} className="me-1" /> Thêm khách ngoài biên chế
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                refetchTransactions();
                refetchPassengers();
              }}
            >
              <RefreshCw size={14} className="me-1" /> Tải lại
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={isSaving || !dirtyEntries.length}
            >
              <Save size={14} className="me-1" /> {isSaving ? 'Đang lưu...' : `Lưu (${dirtyEntries.length})`}
            </button>
          </div>
        </div>

        <TransactionFilters
          trips={trips}
          buses={buses}
          rounds={rounds}
          selectedTripId={selectedTripId}
          selectedBusIds={selectedBusIds}
          selectedRoundIds={selectedRoundIds}
          busDropdownOpen={busDropdownOpen}
          roundDropdownOpen={roundDropdownOpen}
          setSelectedTripId={setSelectedTripId}
          setBusDropdownOpen={setBusDropdownOpen}
          setRoundDropdownOpen={setRoundDropdownOpen}
          toggleBus={toggleBus}
          toggleRound={toggleRound}
          onTripChange={() => setDraftMap({})}
        />

        {showAddPassengerPanel && (
          <div className="attendance-add-panel mt-3">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h6 className="m-0 fw-bold">Thêm khách đang ngồi xe khác</h6>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setShowAddPassengerPanel(false);
                  setSearchKeyword('');
                  setSelectedSearchPassengerId(null);
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="input-group input-group-sm mb-2">
              <span className="input-group-text"><Search size={14} /></span>
              <input
                className="form-control"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setSelectedSearchPassengerId(null);
                }}
                placeholder="Tìm hành khách theo tên..."
              />
            </div>

            <div className="attendance-search-list">
              {searchKeyword.trim().length < 1 ? (
                <div className="text-muted small">Nhập tên để tìm kiếm.</div>
              ) : searchPassengersLoading ? (
                <div className="text-muted small">Đang tìm...</div>
              ) : searchPassengers.length === 0 ? (
                <div className="text-muted small">Không tìm thấy hành khách phù hợp.</div>
              ) : (
                searchPassengers.map((p: any) => {
                  const id = Number(p.id);
                  const assignedBusName = p.bus?.busCode || p.bus?.registrationNumber || 'Chưa rõ';
                  return (
                    <label key={id} className="attendance-search-item">
                      <input
                        type="radio"
                        name="attendance-search-passenger"
                        checked={selectedSearchPassengerId === id}
                        onChange={() => setSelectedSearchPassengerId(id)}
                      />
                      <span>
                        <strong>{p.name}</strong> - {p.tel || '-'} - Biên chế: {assignedBusName}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-2 d-flex justify-content-end">
              <button
                className="btn btn-sm btn-primary"
                disabled={!selectedSearchPassengerId || selectedBusIds.length !== 1}
                onClick={() => {
                  if (!selectedSearchPassengerId || selectedBusIds.length !== 1) return;
                  const picked = searchPassengers.find((p: any) => Number(p.id) === selectedSearchPassengerId);
                  if (!picked) return;

                  const assignedBusName = picked.bus?.busCode || picked.bus?.registrationNumber || 'Chưa rõ';
                  const actualBusId = Number(selectedBusIds[0]);

                  setExtraPassengers((prev) => {
                    if (prev.some((x) => x.id === Number(picked.id))) return prev;
                    return [
                      ...prev,
                      {
                        id: Number(picked.id),
                        name: picked.name || '',
                        tel: picked.tel || '',
                        busId: actualBusId,
                        busName: assignedBusName,
                        assignedBusName,
                      },
                    ];
                  });

                  setSelectedSearchPassengerId(null);
                  setSearchKeyword('');
                  setShowAddPassengerPanel(false);
                }}
              >
                Xác nhận thêm vào bảng
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="row g-2 mt-2 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm mb-1">Lọc theo tên</label>
          <input
            className="form-control form-control-sm"
            placeholder="Nhập tên hành khách..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm mb-1">Lọc lượt đi</label>
          <select
            className="form-select form-select-sm"
            value={departureRoundFilter ?? ''}
            onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Tất cả</option>
            {selectedRounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name || `Chặng ${round.id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label form-label-sm mb-1">Lọc lượt về</label>
          <select
            className="form-select form-select-sm"
            value={returnRoundFilter ?? ''}
            onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Tất cả</option>
            {selectedRounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name || `Chặng ${round.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable<TransactionTableRow>
        title="Bảng điểm danh"
        queryKey={[
          'transaction-table',
          selectedTripId,
          selectedBusIds.join(','),
          selectedRoundIds.join(','),
          nameFilter,
          departureRoundFilter,
          returnRoundFilter,
          dirtyEntries.length,
        ]}
        data={tableRows}
        columns={tableColumns}
        isLoading={isLoading}
        isError={false}
        onRefresh={() => {
          refetchTransactions();
          refetchPassengers();
        }}
        showActionBar={true}
        showPagination={true}
      />
    </div>
  );
};

export default TransactionPage;
