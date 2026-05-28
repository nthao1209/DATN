import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Route} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { buildTripColumns } from './trip/columns';
import { useTheme } from '../../theme/ThemeContext';
import './TripPage.css';
import type { TripRow } from './trip/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const TripPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, TripRow>>({});

  // --- DATA FETCHING ---
  const { data: trips = [], isLoading, isError, refetch} = useQuery<any[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

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
  const pageThemeVars = {
    '--page-primary': colors.primary,
    '--page-primary-11': `${colors.primary}11`,
    '--page-primary-22': `${colors.primary}22`,
    '--page-primary-33': `${colors.primary}33`,
    '--page-surface-light': colors.surfaceLight,
    '--page-background': colors.background,
    '--page-border': colors.border,
    '--page-border-light': colors.borderLight,
    '--page-text-secondary': colors.textSecondary,
    '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
    '--page-table-header-text': isDarkMode ? colors.textSecondary : '#64748b',
  };

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
    <div className="animate-fade-in p-0 p-md-3 trip-page" style={pageThemeVars as React.CSSProperties}>
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
            <Route size={20} style={{ color: colors.primary }} />
          </div>
          <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>Quản lý Lộ trình</h1>
        </div>

        {/* refresh button removed */}
      </div>

      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable
          title="Danh sách lộ trình"
          titleActions={
            <div className="d-flex flex-column align-items-end gap-1">
              <button
                className="btn-custom-action-save shadow-sm"
                onClick={handleSave}
                disabled={isSaving || !canSave}
                title={saveValidationMessage || undefined}
                style={{ 
                  backgroundColor: canSave ? colors.success : colors.surfaceLight, 
                  color: canSave ? '#fff' : colors.textMuted
                }}
              >
                <Save size={16} />
                <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
                <span className="d-inline d-sm-none">{dirtyCount}</span>
              </button>
              {saveValidationMessage && (
                <div className="small text-end" style={{ color: colors.warning, maxWidth: '280px', lineHeight: 1.2 }}>
                  {saveValidationMessage}
                </div>
              )}
            </div>
          }
          columns={columns}
          queryKey={['trips-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => { setDeletedIds([]); setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r))); refetch(); }}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
        />
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
      </div>
    </div>
  );
};

export default TripPage;