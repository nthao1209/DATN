import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Shield} from 'lucide-react';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { buildRoleColumns } from './role-management/columns';
import type { RoleRow } from './role-management/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import './RoleManagementPage.css';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 3;

const RoleManagementPage: React.FC = () => {
  const pageThemeVars = usePageThemeVars();
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState<string | number | null>(null);
  const [focusRowSignal, setFocusRowSignal] = useState(0);
  const initialRowsByIdRef = useRef<Record<number, RoleRow>>({});

  const { data: roles = [], isLoading, isError, refetch} = useQuery<any[]>({
    queryKey: ['roles-management'],
    queryFn: () => api.get('/roles'),
  });

  useEffect(() => {
    const mapped: RoleRow[] = roles.map((role: any) => ({
      id: Number(role.id),
      localId: `db_${role.id}`,
      name: role.name || '',
      description: role.description || '',
      isEdited: false,
    }));

    const initialById: Record<number, RoleRow> = {};
    mapped.forEach((row) => {
      if (row.id) initialById[row.id] = row;
    });
    initialRowsByIdRef.current = initialById;

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        name: '',
        description: '',
      });
    }
    setRows(padded);
  }, [roles]);

  const isSameRow = (current: RoleRow, initial: RoleRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      current.description.trim() === initial.description.trim()
    );
  };

  const isNewRowDirty = (row: RoleRow) => {
    return Boolean(row.name.trim() || row.description.trim());
  };

  // Remove empty role rows on unmount and prevent duplicate empty rows
  useEffect(() => {
    return () => {
      setRows((prev) => prev.filter((r) => r.id || isNewRowDirty(r)));
    };
  }, []);

  const isRowDirty = (row: RoleRow) => {
    if (!row.id) return isNewRowDirty(row);
    const initial = initialRowsByIdRef.current[row.id];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(
    () => rows.filter((r) => (r.id ? isRowDirty(r) : isNewRowDirty(r))).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof RoleRow>(localId: string, key: K, value: RoleRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const nextRow = { ...row, [key]: value };
        if (!row.id) return nextRow;
        const initial = initialRowsByIdRef.current[row.id];
        const isEdited = initial ? !isSameRow(nextRow, initial) : true;
        return { ...nextRow, isEdited };
      })
    );
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
      return [
        ...prev,
        {
          localId,
          name: '',
          description: '',
        },
      ];
    });
  };

  const handleDeleteRow = (row: RoleRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const newRows = rows.filter((r) => !r.id && r.name.trim());
    const updateRows = rows.filter((r) => r.id && isRowDirty(r));

    if (!newRows.length && !updateRows.length && !deletedIds.length) {
      enqueueSnackbar('Không có thay đổi nào', { variant: 'info' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...newRows.map((r) =>
          api.post('/roles', {
            name: r.name.trim(),
            description: r.description.trim() || null,
          })
        ),
        ...updateRows.map((r) =>
          api.put(`/roles/${r.id}`, {
            name: r.name.trim(),
            description: r.description.trim() || null,
          })
        ),
        ...deletedIds.map((id) => api.delete(`/roles/${id}`)),
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

  const columns = buildRoleColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 role-management-page" style={pageThemeVars}>
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div className="role-management-icon d-flex align-items-center justify-content-center rounded-circle shadow-sm">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="role-management-title h4 fw-bold m-0">
              Quản lý Vai trò
            </h1>
          </div>
        </div>
        
        {/* refresh button removed */}
      </div>

      {/* Main Table Card */}
      <div className="role-management-table-card table-container-card shadow-sm">
        <DataTable
          title="Danh sách vai trò"
          titleActions={dirtyCount > 0 ? (
            <button
              className="btn-custom-action-save shadow-sm save-floating-action"
              onClick={handleSave}
              disabled={isSaving || dirtyCount === 0}
            >
              <Save size={16} />
              <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
              <span className="d-inline d-sm-none">{dirtyCount}</span>
            </button>
          ) : null}
          columns={columns}
          queryKey={['roles-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          focusRowKey={focusRowKey}
          focusRowSignal={focusRowSignal}
          onRefresh={() => {
            setDeletedIds([]);
            refetch();
          }}
        />
        <div className="role-management-add-row p-3 border-top">
          <button 
            className="btn-add-row-bottom w-100 py-2" 
            onClick={handleAddRow}
          >
            <Plus size={18} />
            <span className="fw-bold ms-2">Thêm dòng mới</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleManagementPage;

