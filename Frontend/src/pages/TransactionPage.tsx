import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, ClipboardCheck, RefreshCw } from 'lucide-react';
import api from '../services/api';

type PassengerRow = {
  id: number;
  name: string;
  tel: string;
  busId: number | null;
  busName: string;
};

type DraftCell = {
  transactionId?: number;
  passengerId: number;
  roundId: number;
  busId: number;
  checkIn: boolean;
  checkOut: boolean;
  note: string;
  dirty?: boolean;
};

type TransactionRecord = {
  id: number;
  passengerId?: number;
  roundId?: number;
  busId?: number;
  checkIn?: boolean;
  checkOut?: boolean;
  note?: string | null;
  passenger?: {
    id?: number;
    name?: string;
    tel?: string;
    busId?: number;
  };
  round?: {
    id?: number;
    tripId?: number;
    name?: string;
  };
  bus?: {
    id?: number;
    busCode?: string;
    registrationNumber?: string;
  };
};

const keyOf = (passengerId: number, roundId: number) => `${passengerId}_${roundId}`;

const TransactionPage: React.FC = () => {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);

  const {
    data: trips = [],
    isLoading: tripsLoading,
  } = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const {
    data: buses = [],
    isLoading: busesLoading,
  } = useQuery<any[]>({
    queryKey: ['transaction-buses', selectedTripId],
    queryFn: () => api.getBuses(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const {
    data: rounds = [],
    isLoading: roundsLoading,
  } = useQuery<any[]>({
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
    if (!buses.length) {
      setSelectedBusIds([]);
      return;
    }

    setSelectedBusIds((prev) => {
      if (!prev.length) return buses.map((b: any) => Number(b.id));
      const valid = prev.filter((id) => buses.some((b: any) => Number(b.id) === id));
      return valid.length ? valid : buses.map((b: any) => Number(b.id));
    });
  }, [buses]);

  useEffect(() => {
    if (!rounds.length) {
      setSelectedRoundIds([]);
      return;
    }

    setSelectedRoundIds((prev) => {
      if (!prev.length) return rounds.map((r: any) => Number(r.id));
      const valid = prev.filter((id) => rounds.some((r: any) => Number(r.id) === id));
      return valid.length ? valid : rounds.map((r: any) => Number(r.id));
    });
  }, [rounds]);

  const storageKey = useMemo(
    () => (selectedTripId ? `transaction_draft_${selectedTripId}` : ''),
    [selectedTripId]
  );

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
    localStorage.setItem(storageKey, JSON.stringify(draftMap));
  }, [draftMap, storageKey]);

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
        note: tx.note || '',
      };
    });
    return map;
  }, [transactions]);

  const filteredPassengers = useMemo<PassengerRow[]>(() => {
    return passengers
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name || '',
        tel: p.tel || '',
        busId: p.bus?.id ? Number(p.bus.id) : null,
        busName: p.bus?.busCode || p.bus?.registrationNumber || '',
      }))
      .filter((p: PassengerRow) => p.busId && selectedBusIds.includes(Number(p.busId)));
  }, [passengers, selectedBusIds]);

  const selectedRounds = useMemo(
    () => rounds.filter((r: any) => selectedRoundIds.includes(Number(r.id))),
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

  const handleSave = async () => {
    if (!dirtyEntries.length) {
      alert('Không có thay đổi nào để lưu');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all(
        dirtyEntries.map((entry) => {
          if (entry.transactionId) {
            return api.updateTransaction(String(entry.transactionId), {
              checkIn: entry.checkIn,
              checkOut: entry.checkOut,
              note: entry.note?.trim() || null,
            });
          }
          return api.createTransaction({
            passengerId: entry.passengerId,
            roundId: entry.roundId,
            busId: entry.busId,
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            note: entry.note?.trim() || null,
          });
        })
      );

      setDraftMap({});
      if (storageKey) localStorage.removeItem(storageKey);
      await Promise.all([refetchTransactions(), refetchPassengers()]);
      alert('Đã lưu điểm danh thành công');
    } catch (error: any) {
      alert(error?.message || 'Lỗi khi lưu điểm danh');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  return (
    <div className="transaction-page p-2 p-md-3">
      <div className="transaction-toolbar mb-3">
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <h4 className="m-0 fw-bold d-flex align-items-center gap-2">
            <ClipboardCheck size={20} /> Điểm danh hành khách
          </h4>
          <div className="d-flex align-items-center gap-2">
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

        <div className="row g-2 mt-1">
          <div className="col-12 col-md-4">
            <label className="form-label form-label-sm mb-1">Trip</label>
            <select
              className="form-select form-select-sm"
              value={selectedTripId ?? ''}
              onChange={(e) => {
                setSelectedTripId(Number(e.target.value));
                setDraftMap({});
              }}
            >
              {trips.map((trip: any) => (
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
                ? 'Multichoice'
                : `${selectedBusIds.length} xe đã chọn`}
            </button>
            {busDropdownOpen && (
              <div className="multi-menu shadow-sm">
                {buses.map((bus: any) => {
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
            <label className="form-label form-label-sm mb-1">Rounds</label>
            <button
              type="button"
              className="form-select form-select-sm text-start"
              onClick={() => setRoundDropdownOpen((v) => !v)}
            >
              {selectedRoundIds.length === rounds.length
                ? 'Multichoice'
                : `${selectedRoundIds.length} round đã chọn`}
            </button>
            {roundDropdownOpen && (
              <div className="multi-menu shadow-sm">
                {rounds.map((round: any) => {
                  const id = Number(round.id);
                  return (
                    <label key={id} className="multi-item">
                      <input
                        type="checkbox"
                        checked={selectedRoundIds.includes(id)}
                        onChange={() => toggleRound(id)}
                      />
                      <span>{round.name || `Round ${id}`}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="table-responsive transaction-table-wrap">
        <table className="table table-bordered align-middle mb-0 transaction-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: 70 }}>STT</th>
              <th style={{ minWidth: 220 }}>Họ và tên</th>
              <th style={{ minWidth: 140 }}>Liên lạc</th>
              {selectedRounds.map((round: any) => (
                <th key={round.id} style={{ minWidth: 200 }}>
                  {round.name || `Round ${round.id}`}
                </th>
              ))}
              <th style={{ minWidth: 180 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4 + selectedRounds.length} className="text-center py-4">
                  Đang tải dữ liệu...
                </td>
              </tr>
            )}

            {!isLoading && filteredPassengers.length === 0 && (
              <tr>
                <td colSpan={4 + selectedRounds.length} className="text-center py-4">
                  Không có hành khách theo bộ lọc hiện tại.
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredPassengers.map((passenger, index) => {
                const noteSource = selectedRounds
                  .map((round: any) => getCell(passenger.id, Number(round.id))?.note || '')
                  .find((n) => n.trim().length > 0) || '';

                return (
                  <tr key={passenger.id}>
                    <td className="text-center">{index + 1}</td>
                    <td className="fw-semibold">{passenger.name}</td>
                    <td>{passenger.tel || '-'}</td>

                    {selectedRounds.map((round: any) => {
                      const roundId = Number(round.id);
                      const current = getCell(passenger.id, roundId);
                      const checkIn = Boolean(current?.checkIn);
                      const checkOut = Boolean(current?.checkOut);

                      return (
                        <td key={`${passenger.id}_${roundId}`}>
                          <div className="d-flex align-items-center justify-content-center gap-3">
                            <label className="d-flex align-items-center gap-1 small m-0">
                              <input
                                type="checkbox"
                                checked={checkIn}
                                onChange={(e) => {
                                  if (!passenger.busId) return;
                                  setCell({
                                    transactionId: current?.transactionId,
                                    passengerId: passenger.id,
                                    roundId,
                                    busId: passenger.busId,
                                    checkIn: e.target.checked,
                                    checkOut,
                                    note: current?.note || '',
                                  });
                                }}
                              />
                              <span>Vào</span>
                            </label>

                            <label className="d-flex align-items-center gap-1 small m-0">
                              <input
                                type="checkbox"
                                checked={checkOut}
                                onChange={(e) => {
                                  if (!passenger.busId) return;
                                  setCell({
                                    transactionId: current?.transactionId,
                                    passengerId: passenger.id,
                                    roundId,
                                    busId: passenger.busId,
                                    checkIn,
                                    checkOut: e.target.checked,
                                    note: current?.note || '',
                                  });
                                }}
                              />
                              <span>Ra</span>
                            </label>
                          </div>
                        </td>
                      );
                    })}

                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={noteSource}
                        placeholder="Ghi chú"
                        onChange={(e) => {
                          const nextNote = e.target.value;
                          selectedRounds.forEach((round: any) => {
                            const roundId = Number(round.id);
                            const current = getCell(passenger.id, roundId);
                            if (!passenger.busId) return;
                            setCell({
                              transactionId: current?.transactionId,
                              passengerId: passenger.id,
                              roundId,
                              busId: passenger.busId,
                              checkIn: Boolean(current?.checkIn),
                              checkOut: Boolean(current?.checkOut),
                              note: nextNote,
                            });
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <style>{`
        .transaction-page {
          background: #f2f4f8;
          border-radius: 10px;
        }

        .transaction-toolbar {
          background: #ffffff;
          border: 1px solid #d7deeb;
          border-radius: 8px;
          padding: 12px;
        }

        .transaction-table-wrap {
          background: #ffffff;
          border: 1px solid #d7deeb;
          border-radius: 8px;
        }

        .transaction-table thead th {
          background: #3f6dbc;
          color: #fff;
          vertical-align: top;
          font-weight: 700;
        }

        .transaction-table tbody td {
          background: #f8f9fc;
        }

        .multi-menu {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 4px);
          background: #fff;
          border: 1px solid #d7deeb;
          border-radius: 8px;
          z-index: 30;
          max-height: 220px;
          overflow: auto;
          padding: 6px;
        }

        .multi-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }

        .multi-item:hover {
          background: #f3f6ff;
        }

        @media (max-width: 991px) {
          .transaction-table {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
};

export default TransactionPage;
