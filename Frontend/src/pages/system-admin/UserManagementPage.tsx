import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Users } from 'lucide-react';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { format } from 'date-fns';
import { buildUserColumns } from './user-management/columns';
import type { UserRow } from './user-management/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import './UserManagementPage.css';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 1;

const UserManagementPage: React.FC = () => {
  const pageThemeVars = usePageThemeVars();
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const initialRowsByLocalIdRef = useRef<Record<string, UserRow>>({});

  const initializedRef = useRef(false);

  const { data: users = [], isLoading, isError, refetch} = useQuery<any[]>({
    queryKey: ['users-management'],
    queryFn: () => api.get('/users'),
  });

  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
  });

  useEffect(() => {
    // Wait until initial fetch finishes. Avoid mapping on initial empty-array placeholder.
    if (isLoading) return;
    if (initializedRef.current) return;

    const mapped: UserRow[] = users.flatMap((user: any) => {
      const memberships = Array.isArray(user.userTenants) && user.userTenants.length
        ? user.userTenants
        : [null];

      return memberships.map((membership: any) => ({
      id: Number(user.id),
      localId: `db_${user.id}_${membership?.id ?? membership?.tenant?.id ?? 'no_tenant'}`,
      email: user.email || '',
      name: user.name || '',
      createdDate: user.createdDate ? format(new Date(user.createdDate), 'dd/MM/yyyy') : '',
      latestAccessDate: user.lastAccessAt ? format(new Date(user.lastAccessAt), 'dd/MM/yyyy HH:mm') : 'Chưa có',
      latestRole: membership?.role?.name || user.latestRole || 'N/A',
      description: user.description || '',
      roleId: membership?.role?.id ?? null,
      tenantId: membership?.tenant?.id ?? null,
      tenantName: membership?.tenant?.name || '',
      userTenantId: membership?.id ?? null,
      isEdited: false,
      isDisabled: !!user.isDisabled,
      disabledAt: user.disabledAt ?? null,
    }));
    });

    const initialByLocalId: Record<string, UserRow> = {};
    mapped.forEach((row) => {
      initialByLocalId[row.localId] = row;
    });
    initialRowsByLocalIdRef.current = initialByLocalId;

    const padded = [...mapped];
    while (padded.length < MIN_ROWS) {
      padded.push({
        localId: makeLocalId(),
        email: '',
        name: '',
        createdDate: '',
        latestAccessDate: '',
        latestRole: '',
        description: '',
        roleId: null,
        tenantId: null,
        tenantName: '',
        userTenantId: null,
      });
    }

    setRows(padded);
    initializedRef.current = true;
  }, [users, isLoading]);

  const isSameRow = (current: UserRow, initial: UserRow) => {
    return (
      current.name.trim() === initial.name.trim() &&
      (current.description || '').trim() === (initial.description || '').trim() &&
      (current.roleId ?? null) === (initial.roleId ?? null) &&
      (current.tenantId ?? null) === (initial.tenantId ?? null)
    );
  };

  const isRowDirty = (row: UserRow) => {
    if (!row.id) return false;
    const initial = initialRowsByLocalIdRef.current[row.localId];
    if (!initial) return true;
    return !isSameRow(row, initial);
  };

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.id && isRowDirty(r)).length + deletedIds.length,
    [rows, deletedIds]
  );

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleCellChange = <K extends keyof UserRow>(localId: string, key: K, value: UserRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const nextRow = { ...row, [key]: value };
        if (!row.id) return nextRow;
        const initial = initialRowsByLocalIdRef.current[row.localId];
        const isEdited = initial ? !isSameRow(nextRow, initial) : true;
        return { ...nextRow, isEdited };
      })
    );
  };

  const handleDeleteRow = (row: UserRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToUpdate = rows.filter((r) => r.id && isRowDirty(r));

    if (!rowsToUpdate.length && !deletedIds.length) {
      enqueueSnackbar('Không có thay đổi nào', { variant: 'info' });
      return;
    }

    try {
      setIsSaving(true);
      const warnings: string[] = [];

      await Promise.all([
        ...rowsToUpdate.map((r) => {
          const isSystemAdmin = (r.latestRole || '').toLowerCase() === 'system_admin';
          const payload: any = {
            name: r.name.trim(),
            description: r.description?.trim() || null,
          };

          // Only allow role changes between 'admin' and 'busmanagement'. Never allow any change to/from system_admin.
          if (!isSystemAdmin && r.roleId !== undefined && r.roleId !== null) {
            const roleObj = (roles || []).find((rr: any) => Number(rr.id) === Number(r.roleId));
            const newRoleName = (roleObj?.name || '').toLowerCase();
            const oldRoleName = (r.latestRole || '').toLowerCase();
            const allowed = ['admin', 'busmanagement'];

            if (newRoleName === 'system_admin' || oldRoleName === 'system_admin') {
              warnings.push(`Không thể gán hoặc gỡ vai trò 'system_admin' cho ${r.email}`);
            } else if (allowed.includes(oldRoleName) && allowed.includes(newRoleName)) {
              payload.roleId = r.roleId;
              payload.tenantId = r.tenantId;
            } else {
              warnings.push(`Chỉ được đổi giữa 'admin' và 'busmanagement' cho ${r.email}`);
            }
          }

          return api.put(`/users/${r.id}`, payload);
        }),
        ...deletedIds.map((id) => api.delete(`/users/${id}`)),
      ]);

      if (warnings.length) {
        enqueueSnackbar(warnings.join('; '), { variant: 'warning' });
      }
      initializedRef.current = false;
      setDeletedIds([]);
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildUserColumns({
    handleCellChange,
    handleDeleteRow,
    roles: roles || [],
    handleToggleDisabled: async (userId: number, currentIsDisabled: boolean) => {
      try {
        const next = !currentIsDisabled;
        setIsSaving(true);
        await api.setUserStatus(String(userId), next);
        enqueueSnackbar(next ? 'Đã vô hiệu hóa tài khoản' : 'Đã bật lại tài khoản', { variant: 'success' });
        initializedRef.current = false;
        await refetch();
      } catch (err: any) {
        enqueueSnackbar(err?.message || 'Lỗi khi thay đổi trạng thái', { variant: 'error' });
      } finally {
        setIsSaving(false);
      }
    },
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 user-management-page" style={pageThemeVars}>
      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div className="user-management-icon d-flex align-items-center justify-content-center rounded-circle shadow-sm">
            <Users size={22} />
          </div>
          <div>
            <h1 className="user-management-title h4 fw-bold m-0">
              Quản lý Tài khoản
            </h1>
          </div>
        </div>
        
        {/* refresh button removed */}
      </div>

      
      {/* Main Table Card */}
      <div className="user-management-table-card table-container-card shadow-sm">
        <DataTable
          title="Danh sách tài khoản"
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
          queryKey={['users-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => {
            initializedRef.current = false;
            setDeletedIds([]);
            refetch();
          }}
        />      
      </div>
    </div>
  );
};

export default UserManagementPage;

