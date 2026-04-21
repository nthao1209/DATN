import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { TripRow, TripStatus } from './types';

type BuildTripColumnsParams = {
  handleCellChange: <K extends keyof TripRow>(
    localId: string,
    key: K,
    value: TripRow[K]
  ) => void;
  handleDeleteRow: (row: TripRow) => void;
  onManageBuses: (tripId: number) => void;
  onManageRounds: (tripId: number) => void;
};

export const buildTripColumns = ({
  handleCellChange,
  handleDeleteRow,
  onManageBuses,
  onManageRounds,
}: BuildTripColumnsParams): Column<TripRow>[] => [
  { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
  {
    header: 'Tên chuyến',
    key: 'name',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.name}
        onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
        placeholder="Nhập tên chuyến"
      />
    ),
  },
  {
    header: 'Trạng thái',
    key: 'status',
    render: (row) => (
      <select
        className="form-select form-select-sm"
        value={row.status}
        onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as TripStatus)}
      >
        <option value="DOING">Đang diễn ra</option>
        <option value="DONE">Hoàn thành</option>
      </select>
    ),
  },
  {
    header: 'Số xe',
    key: 'busCount',
    render: (row) =>
      row.id ? (
        <button className="btn btn-sm btn-link fw-bold text-decoration-none p-0" onClick={() => onManageBuses(row.id!)}>
          {row.busCount}
        </button>
      ) : (
        '-'
      ),
  },
  {
    header: 'Số round',
    key: 'roundCount',
    render: (row) =>
      row.id ? (
        <button className="btn btn-sm btn-link fw-bold text-decoration-none p-0" onClick={() => onManageRounds(row.id!)}>
          {row.roundCount}
        </button>
      ) : (
        '-'
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
