import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;
const EMPTY_TRIPS: any[] = [];

const TripPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const navigate = useNavigate();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, TripRow>>({});

  // --- DATA FETCHING ---
  const { data: tripsData, isLoading, isError, refetch} = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  const trips = tripsData ?? EMPTY_TRIPS;

  useEffect(() => {
    const mapped: TripRow[] = trips.map((t: any) => ({
      id: Number(t.id),
      localId: `db_${t.id}`,
      name: t.name || '',
      status: t.status === 'DONE' ? 'DONE' : 'DOING',
      busCount: Number(t?._count?.buses || 0),
      roundCount: Number(t?._count?.rounds || 0),
      completedRoundCount: Number(t?.completedRoundCount || 0),
    }));

    const initialById: Record<number, TripRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({ localId: makeLocalId(), name: '', status: 'DOING', busCount: 0, roundCount: 0, completedRoundCount: 0 });
    }
    setRows(padded);
  }, [trips]);

  const isSameRow = (current: TripRow, initial: TripRow) => {
    return current.name.trim() === initial.name.trim() && current.status === initial.status;
  };

  const isNewRowDirty = (row: TripRow) => {
    return Boolean(row.name.trim() || row.status !== 'DOING');
  };

  // Remove empty newly added rows on unmount and prevent multiple empty rows
  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: TripRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

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

  const dirtyCount = useMemo(() => {
    const created = rows.filter((r) => !r.id && isNewRowDirty(r)).length;
    const edited = rows.filter((r) => r.id && isRowDirty(r)).length;
    return created + edited + deletedIds.length;
  }, [rows, deletedIds]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;
  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof TripRow>(localId: string, key: K, value: TripRow[K]) => {
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
    setRows((prev) => {
      const hasEmptyNew = prev.some((r) => !r.id && !isNewRowDirty(r));
      if (hasEmptyNew) {
        const emptyRow = prev.find((r) => !r.id && !isNewRowDirty(r));
        if (emptyRow) {
          setFocusRowKey(emptyRow.localId);
          setFocusRowSignal((value) => value + 1);
        }
        return prev;
      }

      const localId = makeLocalId();
      setFocusRowKey(localId);
      setFocusRowSignal((value) => value + 1);
      return [...prev, { localId, name: '', status: 'DOING', busCount: 0, roundCount: 0, completedRoundCount: 0 }];
    });
  };

  const handleDeleteRow = (row: TripRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ tên chuyến trước khi lưu', { variant: 'warning' });
      return;
    }

    const rowsToCreate = rows.filter((r) => !r.id && r.name.trim());
    const rowsToUpdate = rows.filter((r) => r.id && isRowDirty(r));
    if (!rowsToCreate.length && !rowsToUpdate.length && !deletedIds.length) return;

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToCreate.map((r) => api.createTrip({ name: r.name.trim(), status: r.status })),
        ...rowsToUpdate.map((r) => api.updateTrip(String(r.id), { name: r.name.trim(), status: r.status })),
        ...deletedIds.map((id) => api.deleteTrip(String(id))),
      ]);
      setDeletedIds([]);
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
          titleActions={<SaveChangesAction dirtyCount={dirtyCount} isSaving={isSaving} canSave={canSave} onSave={handleSave} validationMessage={saveValidationMessage} messageMaxWidth="280px" />}
          columns={columns}
          queryKey={['trips-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => { setDeletedIds([]); setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r))); refetch(); }}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
          showAddRow
          onAddRow={handleAddRow}
        />
    </div>
  );
};

export default TripPage;
