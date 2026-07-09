import React, { useMemo, useState } from 'react';
import { Users, Bus, ChevronDown, MapPin, RotateCcw } from 'lucide-react';
import { PassengerExcelImport, PassengerExcelExport } from '../../components/passenger-import';
import api from '../../services/api';
import { normalizePhoneNumber } from '../../utils/phone';
import { buildPassengerColumns } from './passenger/columns';
import './PassengerPage.css';
import type { PassengerRow } from './passenger/types';
import {
  buildPassengerDisplayRows,
  buildPassengerRows,
  buildPassengersSignature,
  createEmptyPassengerRow,
  isNewPassengerRowDirty,
  isSamePassengerRow,
} from './passenger/helpers';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import { useEditableRows } from '../../hooks/useEditableRows';
import { usePassengerFilters } from './passenger/usePassengerFilters';
import { usePassengerImportPreview } from './passenger/usePassengerImportPreview';

const PassengerPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const [isSaving, setIsSaving] = useState(false);
  const [importResetToken, setImportResetToken] = useState(0);
  const {
    selectedTripId,
    setSelectedTripId,
    selectedBusId,
    setSelectedBusId,
    open,
    setOpen,
    trips,
    passengers,
    isLoading,
    isError,
    refetch,
    busesByTrip,
    busOptions,
    isAllTripsView,
    isTargetSelectionReady,
    isPassengerEditingLocked,
  } = usePassengerFilters();

  const passengersSignature = useMemo(() => {
    return buildPassengersSignature(passengers);
  }, [passengers]);

  const {
    rows,
    setRows,
    deletedIds,
    resetDeletedIds,
    focusRowKey,
    focusRowSignal,
    isRowDirty,
    dirtyCount,
    handleCellChange: changeEditableRowCell,
    handleAddRow: addEditableRow,
    handleDeleteRow: deleteEditableRow,
    replaceRows,
    resetFocus,
  } = useEditableRows<PassengerRow>({
    buildRows: () => buildPassengerRows({ sourcePassengers: passengers, selectedTripId, selectedBusId }),
    resetDeps: [passengersSignature, selectedTripId, selectedBusId],
    isSameRow: isSamePassengerRow,
    isNewRowDirty: isNewPassengerRowDirty,
    createRow: () => createEmptyPassengerRow(selectedTripId, selectedBusId),
    resetDeletedIdsOnBuild: true,
  });

  const resetRowsFromPassengers = (sourcePassengers: any[] = passengers) => {
    replaceRows(buildPassengerRows({ sourcePassengers, selectedTripId, selectedBusId }));
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

  const canSave = dirtyCount > 0 && !hasValidationErrors && isTargetSelectionReady;
  const hasUnsavedChanges = dirtyCount > 0;
  useRegisterUnsavedChanges(hasUnsavedChanges);

  const handleCellChange = <K extends keyof PassengerRow>(localId: string, key: K, value: PassengerRow[K]) => {
    if (isPassengerEditingLocked) return;
    changeEditableRowCell(localId, key, value);
  };

  const handleAddRow = () => {
    if (isPassengerEditingLocked) return;
    addEditableRow();
  };

  const handleDeleteRow = (row: PassengerRow) => {
    if (isPassengerEditingLocked) return;
    deleteEditableRow(row);
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
    resetFocus();
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
      (row) => !row.id && isNewPassengerRowDirty(row) && !row.busId
    );

    if (rowsMissingBus.length > 0) {
      enqueueSnackbar(`Có ${rowsMissingBus.length} dòng chưa gán xe. Vui lòng kiểm tra lại trước khi lưu`, { variant: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter((row) => !row.id && row.name.trim() && row.busId).map((row) =>
          api.createPassenger(String(row.tripId), {
            name: row.name.trim(),
            note: row.note || null,
            busId: row.busId,
            tel: normalizePhoneNumber(row.tel) || null,
          })
        ),
        ...rows.filter((row) => row.id && isRowDirty(row)).map((row) =>
          api.updatePassenger(String(row.id), {
            name: row.name.trim(),
            note: row.note || null,
            busId: row.busId,
            tel: normalizePhoneNumber(row.tel) || null,
          })
        ),
        ...deletedIds.map((id) => api.deletePassenger(String(id))),
      ]);
      resetDeletedIds();
      await refetch();
      setImportResetToken((value) => value + 1);
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const { handleImportedPreview } = usePassengerImportPreview({
    setRows,
    enqueueSnackbar,
    selectedTripId,
    selectedBusId,
  });

  const columns = buildPassengerColumns({
    trips: selectedTripId ? trips.filter((trip) => trip.id === selectedTripId) : trips,
    busesByTrip,
    readOnly: isPassengerEditingLocked,
    handleCellChange,
    handleDeleteRow,
  });

  const displayRows = useMemo(
    () => buildPassengerDisplayRows(rows, isAllTripsView),
    [rows, isAllTripsView]
  );

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
                  {trips.find((trip) => trip.id === selectedTripId)?.name || 'Tất cả chuyến đi'}
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

                    {trips.map((trip) => (
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
            onChange={(event) => handleBusChange(event.target.value ? Number(event.target.value) : null)}
            disabled={!selectedTripId}
            title={!selectedTripId ? 'Bạn cần chọn Chuyến đi trước' : ''}
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
