import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Save, Shield } from 'lucide-react';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { buildRoleColumns } from './role-management/columns';
import type { RoleRow } from './role-management/types';

const makeLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const MIN_ROWS = 8;

const RoleManagementPage: React.FC = () => {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);


  const { data: roles = [], isLoading, isError, refetch } = useQuery<any[]>({
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

  const dirtyCount = useMemo(
    () => rows.filter((r) => r.isEdited).length + deletedIds.length,
    [rows, deletedIds]
  );

  const handleCellChange = <K extends keyof RoleRow>(localId: string, key: K, value: RoleRow[K]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId
          ? { ...row, [key]: value, ...(row.id ? { isEdited: true } : {}) }
          : row
      )
    );
  };

  const handleAddNewRow = () => {
    setRows((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        name: '',
        description: '',
      },
    ]);
  };

  const handleDeleteRow = (row: RoleRow) => {
    if (row.id) setDeletedIds((prev) => [...new Set([...prev, row.id!])]);
    setRows((prev) => prev.filter((r) => r.localId !== row.localId));
  };

  const handleSave = async () => {
    const newRows = rows.filter((r) => !r.id && r.name.trim());
    const updateRows = rows.filter((r) => r.id && r.isEdited);

    if (!newRows.length && !updateRows.length && !deletedIds.length) {
      alert('Không có thay đổi nào');
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
      alert('Đã lưu thành công');
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildRoleColumns({
    handleCellChange,
    handleDeleteRow,
  });

  return (
    <div className="p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="m-0 fw-bold d-flex align-items-center gap-2">
            <Shield size={24} /> Quản lý Vai trò
          </h3>
          <div className="text-muted small">Định nghĩa vai trò người dùng</div>
        </div>
      </div>

      <div className="d-grid gap-2 d-md-flex align-items-md-end mb-3">
        <button
          className="btn btn-primary d-flex align-items-center justify-content-center gap-1"
          onClick={handleAddNewRow}
        >
          <Plus size={14} /> Thêm mới
        </button>
        <button
          className="btn btn-success d-flex align-items-center justify-content-center gap-1"
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
        >
          <Save size={14} /> {isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
        </button>
      </div>

      
        <DataTable
          title="Danh sách vai trò"
          columns={columns}
          queryKey={['roles-management-local']}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          onRefresh={() => {
            setDeletedIds([]);
            refetch();
          }}
        />


      <style>{`
        .card .form-control,
        .card .form-select {
          min-height: 44px;
        }
      `}</style>
    </div>
  );
};

export default RoleManagementPage;
