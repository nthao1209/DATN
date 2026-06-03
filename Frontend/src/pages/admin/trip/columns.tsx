import { Trash2, BusFront, Route } from 'lucide-react';
import type { Column } from '../../../components/DataTable';
import { AutoResizeTextarea } from '../../../hooks/useAutoResize';
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
      <div className="td-content d-flex align-items-center" style={{ minHeight: '60px' }}>
        <AutoResizeTextarea
          className="form-control form-control-sm"
          value={row.name}
          onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
          placeholder="Nhập tên chuyến"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff' }}
        />
      </div>
    ),
  },
  {
    header: 'Trạng thái',
    key: 'status',
    render: (row) => {
      const isLocked = Boolean(row.id) && row.roundCount > 0 && row.completedRoundCount < row.roundCount;
      const lockMessage = isLocked
        ? `Chỉ được sửa trạng thái khi đủ ${row.completedRoundCount}/${row.roundCount} round hoàn thành`
        : undefined;

      return (
        <div className="td-content">
          <select
            className="form-select form-select-sm"
            value={row.status}
            disabled={isLocked}
            title={lockMessage}
            onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as TripStatus)}
            style={{
              opacity: isLocked ? 0.55 : 1,
              cursor: isLocked ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="DOING">Đang diễn ra</option>
            <option value="DONE">Hoàn thành</option>
          </select>
        </div>
      );
    },
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
    header: 'Số chặng',
    key: 'roundCount',
    render: (row) =>
      row.id ? (
        <div className="td-content justify-content-center">
          <button 
            className="btn-stat-link stat-round" 
            onClick={() => onManageRounds(row.id!)}
            title="Bấm vào để quản lý chặng của chuyến này"
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
    header: 'Chặng hoàn thành',
    key: 'completedRoundCount',
    render: (row) => (row.id ? `${row.completedRoundCount ?? 0}/${row.roundCount ?? 0}` : '-'),
  },
  {
  header: 'Thao tác',
  key: 'actions',
  width: '100px', 
  render: (row) => (
    <div className="d-flex justify-content-md-center justify-content-end w-100">
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