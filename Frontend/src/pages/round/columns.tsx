import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { RoundRow, RoundStatus } from './types';

type BuildRoundColumnsParams = {
  handleCellChange: <K extends keyof RoundRow>(
    localId: string,
    key: K,
    value: RoundRow[K]
  ) => void;
  handleDeleteRow: (row: RoundRow) => void;
};

export const buildRoundColumns = ({
  handleCellChange,
  handleDeleteRow,
}: BuildRoundColumnsParams): Column<RoundRow>[] => [
  { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
  {
    header: 'Ten chặng',
    key: 'name',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.name}
        onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
        placeholder="Nhập tên chặng"
      />
    ),
  },
  {
    header: 'Thời gian',
    key: 'time',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.time}
        onChange={(e) => handleCellChange(row.localId, 'time', e.target.value)}
        placeholder="Vi du: 08:00"
      />
    ),
  },
  {
    header: 'Tình trạng',
    key: 'status',
    render: (row) => (
      <select
        className="form-select form-select-sm"
        value={row.status}
        onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as RoundStatus)}
      >
        <option value="DOING">Đang diễn ra</option>
        <option value="DONE">Hoàn thành</option>
      </select>
    ),
  },
  {
    header: 'Số check-in',
    key: 'transactionCount',
    render: (row) => (row.id ? row.transactionCount : '-'),
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
