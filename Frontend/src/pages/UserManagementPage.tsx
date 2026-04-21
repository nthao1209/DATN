import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Users } from 'lucide-react';
import DataTable from '../components/DataTable';
import UserMobileView from '../components/mobile/UserMobileView';
import api from '../services/api';
import { format } from 'date-fns';
import { buildUserColumns } from './user-management/columns';
import type { UserRow } from './user-management/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const UserManagementPage: React.FC = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const initializedRef = useRef(false);

  const { data: users = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['users-management'],
    queryFn: () => api.get('/users'),
  });

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;

    const mapped: UserRow[] = users.map((user: any) => ({
      id: Number(user.id),
      localId: `db_${user.id}`,
      email: user.email || '',
      name: user.name || '',
      createdDate: user.createdDate ? format(new Date(user.createdDate), 'dd/MM/yyyy') : '',
      latestAccessDate: user.lastAccessAt ? format(new Date(user.lastAccessAt), 'dd/MM/yyyy HH:mm') : 'Chưa có',
      latestRole: user.latestRole || user.userTenants?.[0]?.role?.name || 'N/A',
      description: user.description || '',
      isEdited: false,
    }));

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
      });
    }

    setRows(padded);
    initializedRef.current = true;
  }, [users]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.isEdited).length + deletedIds.length,
    [rows, deletedIds]
  );

  const handleCellChange = <K extends keyof UserRow>(localId: string, key: K, value: UserRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) }
          : row
      )
    );
  };

  const handleDeleteRow = (row: UserRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const rowsToUpdate = rows.filter((r) => r.id && r.isEdited);

    if (!rowsToUpdate.length && !deletedIds.length) {
      alert('Khong co thay doi nao');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rowsToUpdate.map((r) =>
          api.put(`/users/${r.id}`, {
            name: r.name.trim(),
            description: r.description?.trim() || null,
          })
        ),
        ...deletedIds.map((id) => api.delete(`/users/${id}`)),
      ]);
      initializedRef.current = false;
      setDeletedIds([]);
      await refetch();
      alert('Đã lưu thành công');
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildUserColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="m-0 fw-bold d-flex align-items-center gap-2">
            <Users size={24} /> Quản lý Tài khoản
          </h3>
        </div>
      </div>

      <div className="d-grid gap-2 d-md-flex align-items-md-end mb-3">
        <button
          className="btn btn-success d-flex align-items-center justify-content-center gap-1"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
        >
          <Save size={14} /> {isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
        </button>
      </div>

      {isMobile ? (
        <UserMobileView rows={rows} onDeleteRow={handleDeleteRow} onCellChange={handleCellChange} />
      ) : (
        <DataTable
          title="Danh sách tài khoản"
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
      )}

      <style>{`
        .card .form-control,
        .card .form-select {
          min-height: 44px;
        }
        .text-monospace {
          font-family: monospace;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
};

export default UserManagementPage;
