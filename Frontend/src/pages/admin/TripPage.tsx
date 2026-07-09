import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Route } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { buildTripColumns } from './trip/columns';
import './TripPage.css';
import type { TripRow } from './trip/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import { useEditableRows } from '../../hooks/useEditableRows';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;
const EMPTY_TRIPS: any[] = [];

const isSameTripRow = (current: TripRow, initial: TripRow) =>
  current.name.trim() === initial.name.trim() && current.status === initial.status;

const isNewTripRowDirty = (row: TripRow) =>
  Boolean(row.name.trim() || row.status !== 'DOING');

const createEmptyTripRow = (): TripRow => ({
  localId: makeLocalId(),
  name: '',
  status: 'DOING',
  busCount: 0,
  roundCount: 0,
  completedRoundCount: 0,
});

const TripPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const { data: tripsData, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const trips = tripsData ?? EMPTY_TRIPS;

  const {
    rows,
    deletedIds,
    resetDeletedIds,
    focusRowKey,
    focusRowSignal,
    isRowDirty,
    dirtyCount,
    handleCellChange,
    handleAddRow,
    handleDeleteRow,
    pruneEmptyNewRows,
  } = useEditableRows<TripRow>({
    buildRows: () => {
      const mapped: TripRow[] = trips.map((trip: any) => ({
        id: Number(trip.id),
        localId: `db_${trip.id}`,
        name: trip.name || '',
        status: trip.status === 'DONE' ? 'DONE' : 'DOING',
        busCount: Number(trip?._count?.buses || 0),
        roundCount: Number(trip?._count?.rounds || 0),
        completedRoundCount: Number(trip?.completedRoundCount || 0),
      }));

      const initialById: Record<number, TripRow> = {};
      mapped.forEach((row) => {
        if (row.id) initialById[row.id] = row;
      });

      const rows = [...mapped];
      while (rows.length < MIN_ROWS) rows.push(createEmptyTripRow());

      return { rows, initialById };
    },
    resetDeps: [trips],
    isSameRow: isSameTripRow,
    isNewRowDirty: isNewTripRowDirty,
    createRow: createEmptyTripRow,
  });

  const isRowValid = (row: TripRow) => Boolean(row.name.trim());

  const hasValidationErrors = useMemo(
    () => rows.some((row) => isRowDirty(row) && !isRowValid(row)),
    [rows]
  );

  const saveValidationMessage = useMemo(() => {
    if (!hasValidationErrors) return '';
    const missing = new Set<string>();
    rows.forEach((row) => {
      if (!isRowDirty(row)) return;
      if (!row.name.trim()) missing.add('Tên chuyến');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;
  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleSave = async () => {
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ tên chuyến trước khi lưu', { variant: 'warning' });
      return;
    }

    const rowsToCreate = rows.filter((row) => !row.id && row.name.trim());
    const rowsToUpdate = rows.filter((row) => row.id && isRowDirty(row));
    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) return;

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((row) => api.createTrip({ name: row.name.trim(), status: row.status })),
        ...rowsToUpdate.map((row) => api.updateTrip(String(row.id), { name: row.name.trim(), status: row.status })),
        ...deletedIds.map((id) => api.deleteTrip(String(id))),
      ]);
      resetDeletedIds();
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildTripColumns({
    handleCellChange,
    handleDeleteRow,
    onManageBuses: (id) => navigate(`/trips/${id}/buses`),
    onManageRounds: (id) => navigate(`/trips/${id}/rounds`),
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 trip-page" style={pageThemeVars}>
      <PageTitle icon={<Route size={20} />} title="Quản lý Lộ trình" />

      <EditableTableCard
        title="Danh sách lộ trình"
        titleActions={
          <SaveChangesAction
            dirtyCount={dirtyCount}
            isSaving={isSaving}
            canSave={canSave}
            onSave={handleSave}
            validationMessage={saveValidationMessage}
            messageMaxWidth="280px"
          />
        }
        columns={columns}
        queryKey={['trips-local']}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRefresh={() => {
          resetDeletedIds();
          pruneEmptyNewRows();
          refetch();
        }}
        focusRowKey={focusRowKey}
        focusRowSignal={focusRowSignal}
        showAddRow
        onAddRow={handleAddRow}
      />
    </div>
  );
};

export default TripPage;
