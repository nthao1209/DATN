import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Users, Bus, RefreshCw,ChevronDown, MapPin  } from 'lucide-react';
import DataTable from '../components/DataTable';
import { PassengerExcelImport } from '../components/passenger-import';
import api from '../services/api';
import { normalizePhoneNumber } from '../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import { useTheme } from '../theme/ThemeContext';
import type {
  BusesByTrip,
  PassengerBus,
  PassengerRow,
  PassengerTrip
} from './passenger/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 1;

const PassengerPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importResetToken, setImportResetToken] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, PassengerRow>>({});

  
  const { data: trips = [] } = useQuery<PassengerTrip[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  
  const tripIds = useMemo(
    () => trips.map((t: any) => t.id),
    [trips]
  );

  const { data: allBuses = [] } = useQuery<PassengerBus[]>({
    queryKey: ['buses-all-trips', tripIds],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesPerTrip = await Promise.all(
        tripIds.map((id) => api.getBuses(String(id)))
      );
      return busesPerTrip.flat();
    },
  });

  const { data: passengers = [], isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['passengers', selectedTripId, selectedBusId],
    enabled: trips.length > 0,
    queryFn: async () => {
      if (selectedTripId) return api.getPassengers(String(selectedTripId), selectedBusId ? String(selectedBusId) : undefined);
      const passengersPerTrip = await Promise.all(trips.map((trip) => api.getPassengers(String(trip.id))));
      return passengersPerTrip.flat();
    },
  });

  useEffect(() => {
    if (selectedTripId == null) {
      if (selectedBusId !== null) {
        setSelectedBusId(null);
      }
      return;
    }

    const busesOfSelectedTrip = allBuses.filter(
      (bus: any) => Number(bus.trip?.id) === selectedTripId
    );

    const exists = busesOfSelectedTrip.some(
      (bus) => Number(bus.id) === selectedBusId
    );

    if (!exists && selectedBusId !== null) {
      setSelectedBusId(null);
    }
  }, [selectedTripId, allBuses]);

  const passengersSignature = useMemo(() => {
    if (!passengers) return '';
    return passengers.map((p: any) => `${p.id}-${p.name}-${p.tel}-${p.bus?.id}`).join('|');
  }, [passengers]);

useEffect(() => {
    if (!passengers) return;

    const mapped: PassengerRow[] = passengers.map((p: any) => ({
      id: p.id,
      localId: `db_${p.id}`,
      name: p.name || '',
      tel: p.tel || '',
      note: p.note || '',
      tripId: p.bus?.trip?.id ? Number(p.bus.trip.id) : selectedTripId,
      busId: p.bus?.id ? Number(p.bus.id) : null,
      busCode: p.bus?.busCode || p.bus?.registrationNumber || '',
    }));

    const initialById: Record<number, PassengerRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({ 
        localId: makeLocalId(), 
        name: '', 
        tel: '', 
        note: '', 
        tripId: selectedTripId, 
        busId: selectedBusId, 
        busCode: '' 
      });
    }

    setRows(padded);
    setDeletedIds([]); // Đồng bộ làm sạch hàng đợi đã xóa khi dữ liệu gốc tải lại
  }, [passengersSignature, selectedTripId, selectedBusId]);

  const busesByTrip = useMemo<BusesByTrip>(() => {
    const map: BusesByTrip = {};
    allBuses.forEach((bus: any) => {
      const tId = Number(bus.trip?.id ?? selectedTripId ?? 0);
      if (!map[tId]) map[tId] = [];
      map[tId].push(bus);
    });
    return map;
  }, [allBuses, selectedTripId]);

  const busOptions = useMemo(() => {
      const options = !selectedTripId ? [] : busesByTrip[selectedTripId] || [];
      return [...options].sort((a, b) => {
        return (a.busCode || "").localeCompare(b.busCode || "", undefined, {
          numeric: true,      
          sensitivity: 'base'
        });
      });
    }, [busesByTrip, selectedTripId]);

  const isAllTripsView = selectedTripId === null && selectedBusId === null;
  const isTargetSelectionReady = Boolean(selectedTripId && selectedBusId);

  const isSameRow = (current: PassengerRow, initial: PassengerRow) => {
    const currentNote = (current.note || '').trim();
    const initialNote = (initial.note || '').trim();
    return (
      current.name.trim() === initial.name.trim() &&
      current.tel.trim() === initial.tel.trim() &&
      currentNote === initialNote &&
      (current.busId ?? null) === (initial.busId ?? null)
    );
  };

  const isNewRowDirty = (row: PassengerRow) => {
    const note = (row.note || '').trim();
    return Boolean(row.name.trim() || row.tel.trim() || note || row.busId);
  };

  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: PassengerRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && isNewRowDirty(row)).length;
    const edited = rows.filter((row) => row.id && isRowDirty(row)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  useRegisterUnsavedChanges(dirtyCount > 0);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    setRows((prev) => prev.map((row) => {
      if (row.localId !== localId) return row;
      const nextRow = { ...row, [key]: value };
      if (!row.id) return nextRow;
      const initial = initialRowsByIdRef.current[row.id];
      const isEdited = initial ? !isSameRow(nextRow, initial) : true;
      return { ...nextRow, isEdited };
    }));
  };

  const handleAddRow = () => {
    if (isAllTripsView) return;
    setRows((prev) => {
      const hasEmptyNew = prev.some((r) => !r.id && !isNewRowDirty(r));
      if (hasEmptyNew) return prev;
      return [...prev, { localId: makeLocalId(), name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' }];
    });
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (isAllTripsView) return;
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const handleSave = async () => {
    if (isAllTripsView) return;
    if (!selectedTripId || !selectedBusId) {
      enqueueSnackbar('Vui lòng chọn cả chuyến đi và xe trước khi lưu', { variant: 'warning' });
      return;
    }

    const rowsMissingBus = rows.filter(
      (row) => !row.id && isNewRowDirty(row) && !row.busId
    );

    if (rowsMissingBus.length > 0) {
      enqueueSnackbar(`Có ${rowsMissingBus.length} dòng chưa gán xe. Vui lòng kiểm tra lại trước khi lưu`, { variant: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter(r => !r.id && r.name.trim() && r.busId).map(r => api.createPassenger(String(r.tripId), { name: r.name.trim(), note: r.note || null, busId: r.busId, tel: normalizePhoneNumber(r.tel) || null })),
        ...rows.filter(r => r.id && isRowDirty(r)).map(r => api.updatePassenger(String(r.id), { name: r.name.trim(), note: r.note || null, busId: r.busId, tel: normalizePhoneNumber(r.tel) || null })),
        ...deletedIds.map(id => api.deletePassenger(String(id)))
      ]);
      setDeletedIds([]); await refetch(); setImportResetToken(p => p + 1);
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) { enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' }); } finally { setIsSaving(false); }
  };

  const handleImportedPreview = (payload: {
    rows: Array<{
      localId?: string;
      name: string;
      tel: string;
      note: string;
      tripId: number | null;
      busId: number | null;
      busCode?: string;
    }>;
  }) => {
    setRows((prev) => {
      const keptRows = prev.filter((row) => row.id || isNewRowDirty(row));

      const normalizeForComparison = (text: string) => (text || '').trim().toLowerCase();

      const isDuplicate = (importedRow: PassengerRow) => {
        const importedNameNorm = normalizeForComparison(importedRow.name);
        const importedTelNorm = normalizeForComparison(importedRow.tel);
        const importedNoteNorm = normalizeForComparison(importedRow.note);
        const importedBusId = importedRow.busId;

        return keptRows.some((existing) => {
          const existingNameNorm = normalizeForComparison(existing.name);
          const existingTelNorm = normalizeForComparison(existing.tel);
          const existingNoteNorm = normalizeForComparison(existing.note);
          const existingBusId = existing.busId;

          return (
            importedNameNorm === existingNameNorm &&
            importedTelNorm === existingTelNorm &&
            importedNoteNorm === existingNoteNorm &&
            importedBusId === existingBusId
          );
        });
      };

      const importedRowsRaw: PassengerRow[] = payload.rows.map((row, index) => ({
        localId: row.localId || `excel_${Date.now()}_${index}`,
        name: row.name || '',
        tel: row.tel || '',
        note: row.note || '',
        tripId: row.tripId ?? selectedTripId,
        busId: row.busId ?? selectedBusId ?? null,
        busCode: row.busCode || '',
      }));

      const importedRows = importedRowsRaw.filter((row) => !isDuplicate(row));
      const skippedCount = importedRowsRaw.length - importedRows.length;

      if (skippedCount > 0) {
        enqueueSnackbar(
          `Đã bỏ qua ${skippedCount} dòng vì trùng dữ liệu (tên + sdt + số xe + ghi chú)`,
          { variant: 'warning' }
        );
      }

      const nextRows = [...keptRows, ...importedRows];

      if (!nextRows.length) {
        nextRows.push({
          localId: makeLocalId(),
          name: '',
          tel: '',
          note: '',
          tripId: selectedTripId,
          busId: selectedBusId,
          busCode: '',
        });
      }

      return nextRows;
    });
  };

  const columns = buildPassengerColumns({
    trips: selectedTripId ? trips.filter(t => t.id === selectedTripId) : trips,
    busesByTrip, readOnly: isAllTripsView, handleCellChange, handleDeleteRow,
  });

  const displayRows = useMemo(() => {
    if (!isAllTripsView) return rows;

    const groups: Record<string, PassengerRow & { tripAssignments?: Record<number, any> }> = {};

    const keyFor = (r: PassengerRow) => `${(r.name||'').trim().toLowerCase()}||${(r.tel||'').trim().toLowerCase()}||${(r.note||'').trim().toLowerCase()}`;

    rows.forEach((r) => {
      const key = keyFor(r);
      if (!groups[key]) {
        groups[key] = {
          localId: `agg_${Object.keys(groups).length}_${Date.now()}`,
          name: r.name,
          tel: r.tel,
          note: r.note,
          tripId: null,
          busId: null,
          busCode: '',
          tripAssignments: {},
        } as any;
      }

      const tripId = r.tripId ?? 0;
      const group = groups[key];
      if (!group.tripAssignments) group.tripAssignments = {};
      if (!group.tripAssignments[tripId]) {
        group.tripAssignments[tripId] = { tripId, busCodes: new Set<string>() } as any;
      }
      if (r.busCode) (group.tripAssignments[tripId] as any).busCodes.add(r.busCode);
    });

    const result = Object.values(groups).map((g) => {
      const assignments: Record<number, any> = {};
      const ta = g.tripAssignments || {};
      Object.keys(ta).forEach((k) => {
        const tId = Number(k);
        const busCodesSet: Set<string> = (ta[tId] as any).busCodes || new Set<string>();
        assignments[tId] = { tripId: tId, busCode: Array.from(busCodesSet).join(', ') };
      });
      return { ...g, tripAssignments: assignments } as PassengerRow;
    });

    return result;
  }, [rows, isAllTripsView]);

  return (
    <div className="animate-fade-in p-0 p-md-3 passenger-page">
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
            style={{ 
                width: '42px', 
                height: '42px', 
                backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
                border: `1px solid ${colors.primary}33`
            }}
          >
            <Users size={22} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Quản lý Hành khách</h1>
        </div>
        
        <button 
          className="btn-refresh-custom shadow-sm" 
          onClick={() => refetch()} 
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
        >
          <RefreshCw size={18} className={isFetching ? 'spin' : ''} />
        </button>
      </div>

      
      <div 
        className="p-2 mb-4 d-flex align-items-center flex-wrap gap-3 px-3 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.md,
          border: `1px solid ${colors.border}`,
        }}
      >
       <div className="dropdown-custom-container" style={{ position: 'relative', width: '280px' }}>
        <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: '0', flexBasis: '280px' }}>
          <MapPin size={16} style={{ color: colors.textSecondary }} className="flex-shrink-0" />
          
          <div className="dropdown-custom-container" style={{ position: 'relative', width: '100%' }}>
            <div 
              className={`custom-filter-input d-flex align-items-center justify-content-between cursor-pointer ${open ? 'active' : ''}`}
              onClick={() => setOpen(!open)}
              style={{ 
                whiteSpace: 'normal', 
                minHeight: '38px', 
                height: 'auto', 
                padding: '8px 12px',
                lineHeight: '1.4',
                backgroundColor: isDarkMode ? colors.background : '#fff',
                borderRadius: '10px',
                border: `1px solid ${open ? colors.primary : colors.border}`,
                transition: 'all 0.2s ease',
                color: colors.textPrimary,
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '500' }}>
                {trips.find(t => t.id === selectedTripId)?.name || "Tất cả chuyến đi"}
              </span>
              <ChevronDown 
                size={14} 
                className={`ms-2 transition-all flex-shrink-0 ${open ? 'rotate-180' : ''}`} 
                style={{ color: colors.textSecondary }}
              />
            </div>

            {open && (
              <div className="custom-multi-menu shadow-lg animate-fade-in" style={{ 
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 1000, 
                backgroundColor: isDarkMode ? colors.background : '#ffffff', borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden'
              }}>
                <div className="menu-header" style={{ padding: '10px 15px', fontSize: '11px', fontWeight: '700', opacity: 0.8, borderBottom: `1px solid ${colors.border}55`, color: colors.textPrimary, backgroundColor: isDarkMode ? colors.surface : '#f0f0ed'}}>
                  DANH SÁCH CHUYẾN ĐI
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '6px' }}>
                  
                  <div 
                    className={`multi-item-custom ${selectedTripId === null ? 'selected' : ''}`}
                    onClick={() => { setSelectedTripId(null); setOpen(false); }}
                    style={{ 
                      whiteSpace: 'normal', 
                      fontSize: '13px', 
                      padding: '10px 12px', 
                      borderRadius: '8px', 
                      marginBottom: '2px', 
                      cursor: 'pointer', 
                      lineHeight: '1.4',
                      fontWeight: selectedTripId === null ? '600' : '500'
                    }}
                  >
                    Tất cả chuyến đi
                  </div>

                  {trips.map(trip => (
                    <div 
                      key={trip.id} 
                      className={`multi-item-custom ${selectedTripId === trip.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedTripId(trip.id); setOpen(false); }}
                      style={{ whiteSpace: 'normal', fontSize: '13px', padding: '10px 12px', borderRadius: '8px', marginBottom: '2px', cursor: 'pointer', lineHeight: '1.4' }}
                    >
                      {trip.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0" 
             style={{ minWidth: '200px' }}
        >
          <Bus size={14} style={{ color: colors.textSecondary }} className="flex-shrink-0" />
          <select
            className="form-select-custom-toolbar w-100"
            value={selectedBusId ?? ''}
            onChange={(e) => setSelectedBusId(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedTripId}
            title={!selectedTripId ? "Bạn cần chọn Chuyến đi trước" : ""}
            style={{ 
              backgroundColor: isDarkMode ? colors.background : '#fff',
              color: colors.textPrimary, 
              border: `1px solid ${colors.border}`,
              opacity: !selectedTripId ? 0.6 : 1
            }}
          >
            <option value="">Tất cả xe</option>
            {busOptions.map((bus: any) => (
              <option key={bus.id} value={bus.id}>{bus.busCode}</option>
            ))}
          </select>
        </div>

        <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0 ms-md-auto">
          
          {!isAllTripsView && (
            <PassengerExcelImport 
              selectedTripId={selectedTripId} 
              resetToken={importResetToken} 
              disabled={isSaving || !isTargetSelectionReady} 
              onImported={handleImportedPreview}
            />
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách hành khách"
          titleActions={
            <button
              className="btn-custom-action-save shadow-sm"
              onClick={handleSave}
              disabled={isSaving || dirtyCount === 0 || !isTargetSelectionReady}
              style={{ 
                backgroundColor: dirtyCount > 0 ? colors.success : colors.surfaceLight, 
                color: dirtyCount > 0 ? '#fff' : colors.textMuted
              }}
            >
              <Save size={16} />
              <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
              <span className="d-inline d-sm-none">{dirtyCount}</span>
            </button>
          }         
          columns={columns}
          queryKey={['passengers-local', selectedTripId, selectedBusId]}
          data={displayRows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={refetch}
        />
        {!isAllTripsView && (
          <div className="p-3 border-top" style={{ borderColor: colors.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#fcfcfc' }}>
            <button 
              className="btn-add-row-bottom w-100 py-2" 
              onClick={handleAddRow}
              style={{ 
                color: colors.primary, 
                border: `1px dashed ${colors.primary}66`,
                borderRadius: '8px',
                backgroundColor: `${colors.primary}08`
              }}
            >
              <Plus size={18} />
              <span className="fw-bold ms-2">Thêm dòng mới</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        /* Ô nhập liệu trong bảng sắc nét hơn */
        .passenger-page .td-content input, 
        .passenger-page .td-content select {
          min-height: 36px !important;
          border: 1px solid ${isDarkMode ? colors.borderLight : '#cbd5e1'} !important;
          background-color: ${isDarkMode ? colors.background : '#fff'} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          transition: all 0.2s;
        }
        
        .passenger-page .td-content input:focus, 
        .passenger-page .td-content select:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px ${colors.primary}22 !important;
          outline: none;
        }

        /* Select trên Toolbar gọn gàng */
        .form-select-custom-toolbar {
          height: 34px;
          padding: 0 30px 0 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
        }
        .custom-filter-input {
    background-color: ${isDarkMode ? 'rgba(255,255,255,0.05)' : '#ffffff'};
    border: 1px solid ${colors.border};
    border-radius: 10px;
    color: ${colors.textPrimary};
    transition: all 0.2s ease;
  }

  .custom-filter-input.active {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 3px ${colors.primary}22;
  }

  /* Hiệu ứng khi di chuột vào từng dòng chuyến đi */
  .multi-item-custom:hover {
    background-color: ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9'};
    color: ${colors.primary};
  }

  /* Trạng thái chuyến đi đang được chọn */
  .multi-item-custom.selected {
    background-color: ${colors.primary}15;
    color: ${colors.primary};
    font-weight: 600;
  }

  .rotate-180 { transform: rotate(180deg); }
  .transition-all { transition: all 0.3s ease; }
  
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }

        /* Nút bấm Gọn & Hiệu ứng lún */
        .btn-custom-action-small, .btn-custom-action-save {
          display: flex; align-items: center; gap: 6px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; border-radius: 8px; border: none; transition: all 0.2s;
          background: transparent;
        }
        .btn-custom-action-small:hover { background: ${colors.primary}11; transform: translateY(-1px); }
        .btn-custom-action-save:not(:disabled):hover { filter: brightness(1.05); transform: translateY(-1px); }
        .btn-custom-action-save:active { transform: scale(0.96); }

        .btn-refresh-custom {
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s; cursor: pointer;
        }
        .btn-refresh-custom:hover { background-color: ${colors.surfaceLight} !important; transform: rotate(15deg); }

        /* Làm mờ Header Bảng - Cực nhẹ cho bản Light */
        .table thead th {
          background-color: ${isDarkMode ? colors.surfaceLight : '#f8fafc'} !important;
          color: ${isDarkMode ? colors.textSecondary : '#64748b'} !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 12px !important;
          border-bottom: 1px solid ${colors.border} !important;
          font-weight: 700 !important;
        }
        .passenger-page .btn-action-delete {
          /* Ép kích thước và layout */
          width: 36px !important;
          height: 36px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;          
          border-radius: 10px !important;
          border: 1px solid rgba(220, 53, 69, 0.2) !important;
          background-color: rgba(220, 53, 69, 0.05) !important;
          color: #dc3545 !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          cursor: pointer !important;
          outline: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .passenger-page .btn-action-delete:hover {
          background-color: #dc3545 !important;
          color: #ffffff !important;
          border-color: #dc3545 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
        }

        .passenger-page .btn-action-delete:active {
          transform: scale(0.9) !important; /* Nút thu nhỏ lại khi nhấn */
          background-color: #a71d2a !important;
          box-shadow: none !important;
        }

        /* 4. Đảm bảo icon Trash2 không bị dính màu đen của bảng */
        .passenger-page .btn-action-delete svg {
          color: #ffffff !important; 
          fill: none !important;
        }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default PassengerPage;