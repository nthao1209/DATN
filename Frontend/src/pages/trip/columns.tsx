import { Trash2, BusFront, Route } from 'lucide-react';
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
      <div className="td-content">
        <input
          className="form-control form-control-sm"
          value={row.name}
          onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
          placeholder="Nhập tên chuyến"
        />
      </div>
    ),
  },
  {
    header: 'Trạng thái',
    key: 'status',
    render: (row) => (
      <div className="td-content">
        <select
          className="form-select form-select-sm"
          value={row.status}
          onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as TripStatus)}
        >
          <option value="DOING">Đang diễn ra</option>
          <option value="DONE">Hoàn thành</option>
        </select>
      </div>
    ),
  },
  {
    header: 'Số xe',
    key: 'busCount',
    render: (row) =>
      row.id ? (
        <div className="td-content justify-content-center">
          <button 
            className="btn-stat-link stat-bus" 
            onClick={() => onManageBuses(row.id!)}
            title="Bấm vào để quản lý xe của chuyến này"
          >
            <BusFront size={14} className="me-1 opacity-75" />
            <span>{row.busCount}</span>
          </button>
        </div>
      ) : (
        <span className="opacity-25">-</span>
      ),
  },
  {
    header: 'Số round',
    key: 'roundCount',
    render: (row) =>
      row.id ? (
        <div className="td-content justify-content-center">
          <button 
            className="btn-stat-link stat-round" 
            onClick={() => onManageRounds(row.id!)}
            title="Bấm vào để quản lý round của chuyến này"
          >
            <Route size={14} className="me-1 opacity-75" />
            <span>{row.roundCount}</span>
          </button>
        </div>
      ) : (
        <span className="opacity-25">-</span>
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
        title="Xóa chuyến đi"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
},
];