import { Trash2 } from 'lucide-react';
import type { Column } from '../../../components/DataTable';
import type { RoleRow } from './types';

type BuildRoleColumnsParams = {
  handleCellChange: <K extends keyof RoleRow>(
    localId: string,
    key: K,
    value: RoleRow[K]
  ) => void;
  handleDeleteRow: (row: RoleRow) => void;
};

export const buildRoleColumns = ({
  handleCellChange,
  handleDeleteRow,
}: BuildRoleColumnsParams): Column<RoleRow>[] => [
  { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
  {
    header: 'Tên Role',
    key: 'name',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.name}
        onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
        placeholder="Tên role"
      />
    ),
  },
  {
    header: 'Mô tả',
    key: 'description',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.description}
        onChange={(e) => handleCellChange(row.localId, 'description', e.target.value)}
        placeholder="Mô tả role"
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
        title="Xóa quyền"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
},
];
