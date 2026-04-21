import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { UserRow } from './types';

type BuildUserColumnsParams = {
  handleCellChange: <K extends keyof UserRow>(
    localId: string,
    key: K,
    value: UserRow[K]
  ) => void;
  handleDeleteRow: (row: UserRow) => void;
};

export const buildUserColumns = ({
  handleCellChange,
  handleDeleteRow,
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
    render: (row) => <span className="badge bg-info">{row.latestRole}</span>,
  },
  {
    header: 'Ghi chú',
    key: 'description',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.description}
        onChange={(e) => handleCellChange(row.localId, 'description', e.target.value)}
        placeholder="Ghi chú"
      />
    ),
  },
  {
    header: 'Thao tác',
    key: 'actions',
    render: (row) => (
      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRow(row)}>
        <Trash2 size={14} />
      </button>
    ),
  },
];
