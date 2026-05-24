import { Trash2 } from 'lucide-react';
import type { Column } from '../../../components/DataTable';
import { AutoResizeTextarea } from '../../../hooks/useAutoResize';
import type { UserRow } from './types';

type BuildUserColumnsParams = {
  handleCellChange: <K extends keyof UserRow>(
    localId: string,
    key: K,
    value: UserRow[K]
  ) => void;
  handleDeleteRow: (row: UserRow) => void;
  roles: { id: number; name: string }[];
};

export const buildUserColumns = ({
  handleCellChange,
  handleDeleteRow,
  roles,
}: BuildUserColumnsParams): Column<UserRow>[] => [
  { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
  {
    header: 'Email',
    key: 'email',
    render: (row) => <span className="text-monospace">{row.email}</span>,
  },
  {
    header: 'Tên',
    key: 'name',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.name}
        onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
        placeholder="Tên user"
      />
    ),
  },
  { header: 'Ngày tạo', key: 'createdDate', render: (row) => row.createdDate },
  {
    header: 'Truy cập gần nhất',
    key: 'latestAccessDate',
    render: (row) => row.latestAccessDate,
  },
  {
    header: 'Role',
    key: 'latestRole',
    render: (row) => {
      const isSystemAdmin = (row.latestRole || '').toLowerCase() === 'system_admin';
      const allowedNames = ['admin', 'busmanagement'];
      const allowedRoles = roles.filter((r) => allowedNames.includes((r.name || '').toLowerCase()));

      if (isSystemAdmin) {
        return <span className="badge bg-secondary">system_admin</span>;
      }

      return (
        <select
          className="form-control form-control-sm"
          value={row.roleId ?? ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            handleCellChange(row.localId, 'roleId', val);
          }}
        >
          <option value="">{row.latestRole || 'N/A'}</option>
          {allowedRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      );
    },
  },
  {
    header: 'Ghi chú',
    key: 'description',
    render: (row) => (
      <AutoResizeTextarea
        className="form-control form-control-sm user-note-input"
        value={row.description}
        onChange={(e) => handleCellChange(row.localId, 'description', e.target.value)}
        placeholder="Ghi chú"
      />
    ),
  },
  {
  header: 'Thao tác',
  key: 'actions',
  width: '100px', 
  render: (row) => (
    <div className="d-flex justify-content-center align-items-center">
      <button 
        className="btn-action-delete" 
        onClick={() => handleDeleteRow(row)} 
        title="Xóa người dùng"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
},
];
