import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Bus, ChevronDown, MapPin, RotateCcw } from 'lucide-react';
import { PassengerExcelImport, PassengerExcelExport } from '../../components/passenger-import';
import api from '../../services/api';
import { normalizePhoneNumber } from '../../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import './PassengerPage.css';
import type {
  BusesByTrip,
  PassengerBus,
  PassengerRow,
  PassengerTrip
} from './passenger/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const EMPTY_ROWS_COUNT = 1;
const normalizePassengerTel = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text.toLowerCase() === 'null' ? '' : text;
};

const PassengerPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PassengerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importResetToken, setImportResetToken] = useState(0);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
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
    // PassengerPage cần bus của mọi chuyến để lọc, import và đổi xe cho khách.
    queryKey: ['buses-all-trips', tripIds],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesPerTrip = await Promise.all(
        tripIds.map((id) => api.getBuses(String(id)))
      );
      return busesPerTrip.flat();
    },
  });

  const { data: passengers = [], isLoading, isError, refetch } = useQuery<any[]>({
    // Nếu chưa chọn chuyến thì lấy khách của tất cả chuyến; chọn rồi thì lọc theo chuyến/xe.
    queryKey: ['passengers', selectedTripId, selectedBusId],
    enabled: trips.length > 0,
    queryFn: async () => {
      if (selectedTripId) return api.getPassengers(String(selectedTripId), selectedBusId ? String(selectedBusId) : undefined);
      const passengersPerTrip = await Promise.all(trips.map((trip) => api.getPassengers(String(trip.id))));
      return passengersPerTrip.flat();
    },
  });

  useEffect(() => {
    // Khi đổi chuyến, nếu xe đang chọn không thuộc chuyến mới thì reset xe.
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

  const buildRowsFromPassengers = (sourcePassengers: any[]) => {
    const mapped: PassengerRow[] = sourcePassengers.map((p: any) => ({
      id: p.id,
      localId: `db_${p.id}`,
      name: p.name || '',
      tel: normalizePassengerTel(p.tel),
      note: p.note || '',
      tripId: p.bus?.trip?.id ? Number(p.bus.trip.id) : selectedTripId,
      busId: p.bus?.id ? Number(p.bus.id) : null,
      busCode: p.bus?.busCode || p.bus?.registrationNumber || '',
    }));

    const initialById: Record<number, PassengerRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });

    const padded = [...mapped];
    while (padded.length < EMPTY_ROWS_COUNT) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        tel: '',
        note: '',
        tripId: selectedTripId,
        busId: selectedBusId,
        busCode: '',
      });
    }

    return { rows: padded, initialById };
  };

  const resetRowsFromPassengers = (sourcePassengers: any[] = passengers) => {
    const next = buildRowsFromPassengers(sourcePassengers);
    initialRowsByIdRef.current = next.initialById;
    setRows(next.rows);
    setDeletedIds([]);
  };

  const passengersSignature = useMemo(() => {
    // Signature gồm cả note để lưu ghi chú xong không còn bị coi là "chưa lưu".
    if (!passengers) return '';
    return passengers
      .map((p: any) =>
        [
          p.id,
          p.name,
          normalizePassengerTel(p.tel),
          p.note || '',
          p.bus?.id,
        ].join('-')
      )
      .join('|');
  }, [passengers]);

useEffect(() => {
    // Map passenger API thành rows edit được và lưu snapshot gốc để dirty-check.
    if (!passengers) return;

    const next = buildRowsFromPassengers(passengers);
    initialRowsByIdRef.current = next.initialById;
    setRows(next.rows);
    setDeletedIds([]);
  }, [passengersSignature, selectedTripId, selectedBusId]);

  const busesByTrip = useMemo<BusesByTrip>(() => {
    // Gom bus theo trip để dropdown xe chỉ hiện đúng xe của chuyến đang chọn.
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
  const isPassengerEditingLocked = !isTargetSelectionReady;

  const isSameRow = (current: PassengerRow, initial: PassengerRow) => {
    // So sánh cả ghi chú và xe để biết row đã khác dữ liệu gốc hay chưa.
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
    return Boolean(row.name.trim() || row.tel.trim() || note);
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

  const isRowValid = (row: PassengerRow) => Boolean(row.name.trim() && row.busId);

  const hasValidationErrors = useMemo(
    () => rows.some((row) => isRowDirty(row) && !isRowValid(row)),
    [rows]
  );

  const saveValidationMessage = useMemo(() => {
    if (!hasValidationErrors) return '';
    const missing = new Set<string>();
    rows.forEach((row) => {
      if (!isRowDirty(row)) return;
      if (!row.name.trim()) missing.add('Tên khách');
      if (!row.busId) missing.add('Xe');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const dirtyCount = useMemo(() => {
    const created = rows.filter((row) => !row.id && isNewRowDirty(row)).length;
    const edited = rows.filter((row) => row.id && isRowDirty(row)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const canSave = dirtyCount > 0 && !hasValidationErrors && isTargetSelectionReady;
  const hasUnsavedChanges = dirtyCount > 0;
  useRegisterUnsavedChanges(hasUnsavedChanges);

  // --- ACTIONS ---
  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    if (isPassengerEditingLocked) return;

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
    if (isPassengerEditingLocked) return;
    const emptyRow = rows.find((row) => !row.id && !isNewRowDirty(row));

    if (emptyRow) {
      setFocusRowKey(emptyRow.localId);
      setFocusRowSignal((value) => value + 1);
      return;
    }

    const localId = makeLocalId();
    setRows((prev) => [
      ...prev,
      { localId, name: '', tel: '', note: '', tripId: selectedTripId, busId: selectedBusId, busCode: '' },
    ]);
    setFocusRowKey(localId);
    setFocusRowSignal((value) => value + 1);
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (isPassengerEditingLocked) return;
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((item) => item.localId !== row.localId));
  };

  const warnUnsavedSelectionChange = () => {
    enqueueSnackbar('Bạn có dữ liệu chưa lưu. Vui lòng lưu hoặc bấm "Bỏ thay đổi" trước khi đổi chuyến/xe.', { variant: 'warning' });
  };

  const handleTripChange = (tripId: number | null) => {
    if (tripId === selectedTripId) {
      setOpen(false);
      return;
    }

    if (hasUnsavedChanges) {
      warnUnsavedSelectionChange();
      setOpen(false);
      return;
    }

    setSelectedTripId(tripId);
    setOpen(false);
  };

  const handleBusChange = (busId: number | null) => {
    if (busId === selectedBusId) return;

    if (hasUnsavedChanges) {
      warnUnsavedSelectionChange();
      return;
    }

    setSelectedBusId(busId);
  };

  const handleDiscardChanges = async () => {
    resetRowsFromPassengers(passengers);
    setImportResetToken((value) => value + 1);
    setFocusRowKey(null);
    setFocusRowSignal((value) => value + 1);
    await refetch();
    enqueueSnackbar('Đã bỏ thay đổi chưa lưu', { variant: 'info' });
  };

  const handleSave = async () => {
    if (isPassengerEditingLocked) return;
    if (!selectedTripId || !selectedBusId) {
      enqueueSnackbar('Vui lòng chọn cả chuyến đi và xe trước khi lưu', { variant: 'warning' });
      return;
    }

    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ tên và gán xe cho các dòng cần lưu', { variant: 'warning' });
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
    busesByTrip, readOnly: isPassengerEditingLocked, handleCellChange, handleDeleteRow,
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
    <div className="animate-fade-in p-0 p-md-3 passenger-page" style={pageThemeVars}>
      <PageTitle icon={<Users size={22} />} title="Quản lý Hành khách" />

      
      <div className="passenger-filter-bar p-2 mb-4 d-flex align-items-center flex-wrap gap-3 px-3 shadow-sm">
       <div className="passenger-trip-shell dropdown-custom-container">
        <div className="passenger-trip-filter d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0">
          <MapPin size={16} className="passenger-filter-icon flex-shrink-0" />
          
          <div className="passenger-trip-dropdown dropdown-custom-container">
            <div 
              className={`custom-filter-input d-flex align-items-center justify-content-between cursor-pointer ${open ? 'active' : ''}`}
              onClick={() => setOpen(!open)}
            >
              <span className="trip-filter-text">
                {trips.find(t => t.id === selectedTripId)?.name || "Tất cả chuyến đi"}
              </span>
              <ChevronDown 
                size={14} 
                className={`passenger-filter-icon ms-2 transition-all flex-shrink-0 ${open ? 'rotate-180' : ''}`}
              />
            </div>

            {open && (
              <div className="passenger-trip-menu custom-multi-menu shadow-lg animate-fade-in">
                <div className="passenger-trip-menu-header menu-header">
                  DANH SÁCH CHUYẾN ĐI
                </div>
                <div className="passenger-trip-menu-body">
                  
                  <div 
                    className={`multi-item-custom ${selectedTripId === null ? 'selected' : ''}`}
                    onClick={() => handleTripChange(null)}
                  >
                    Tất cả chuyến đi
                  </div>

                  {trips.map(trip => (
                    <div 
                      key={trip.id} 
                      className={`multi-item-custom ${selectedTripId === trip.id ? 'selected' : ''}`}
                      onClick={() => handleTripChange(trip.id)}
                    >
                      <span className="trip-menu-text">{trip.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        <div className="passenger-bus-filter d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0">
          <Bus size={14} className="passenger-filter-icon flex-shrink-0" />
          <select
            className="form-select-custom-toolbar w-100"
            value={selectedBusId ?? ''}
            onChange={(e) => handleBusChange(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedTripId}
            title={!selectedTripId ? "Bạn cần chọn Chuyến đi trước" : ""}
          >
            <option value="">Tất cả xe</option>
            {busOptions.map((bus: any) => (
              <option key={bus.id} value={bus.id}>{bus.busCode}</option>
            ))}
          </select>
        </div>

        <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0 ms-md-auto">
          
          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            {isTargetSelectionReady && (
              <PassengerExcelImport 
                selectedTripId={selectedTripId} 
                resetToken={importResetToken} 
                disabled={isSaving || !isTargetSelectionReady} 
                onImported={handleImportedPreview}
              />
            )}
            {!isAllTripsView && (
              <PassengerExcelExport
                rows={displayRows}
                trips={selectedTripId ? trips.filter((trip) => trip.id === selectedTripId) : trips}
                selectedTripId={selectedTripId}
                disabled={isSaving || !displayRows.length}
              />
            )}
          </div>
        </div>
      </div>

      <EditableTableCard
          title="Danh sách hành khách"
          titleActions={
            <SaveChangesAction
              dirtyCount={dirtyCount}
              isSaving={isSaving}
              canSave={canSave}
              onSave={handleSave}
              validationMessage={saveValidationMessage}
              leadingAction={
              <button
                className="btn-custom-action-small shadow-sm"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                title="Bỏ các thay đổi chưa lưu"
              >
                <RotateCcw size={16} />
                <span className="d-none d-sm-inline">Bỏ thay đổi</span>
              </button>
              }
            />
          }         
          columns={columns}
          queryKey={['passengers-local', selectedTripId, selectedBusId]}
          data={displayRows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={refetch}
          initialPageSize={50}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
          showAddRow={!isPassengerEditingLocked}
          onAddRow={handleAddRow}
        />

    </div>
  );
};

export default PassengerPage;


