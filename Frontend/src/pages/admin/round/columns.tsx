import { Trash2, Lock } from 'lucide-react';
import type { Column } from '../../../components/DataTable';
import type { RoundRow, RoundStatus } from './types';

type BuildRoundColumnsParams = {
  handleCellChange: <K extends keyof RoundRow>(
    localId: string,
    key: K,
    value: RoundRow[K]
  ) => void;
  handleDeleteRow: (row: RoundRow) => void;
  openLocksForRound?: (
      roundId: number,
      lockType: 'check_in' | 'check_out'
    ) => void;
};

export const buildRoundColumns = ({
  handleCellChange,
  handleDeleteRow,
  openLocksForRound,
}: BuildRoundColumnsParams): Column<RoundRow>[] => [
  { header: 'STT', key: 'stt', width: '44px', render: (_row, idx) => idx + 1 },
  {
    header: 'Tên chặng',
    key: 'name',
    width: '160px',
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
    width: '110px',
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
    width: '120px',
    render: (row) => {
      const isLocked = Boolean(row.id) && row.busCount > 0 && row.completedBusCount < row.busCount;
      const lockMessage = isLocked
        ? `Chỉ được sửa trạng thái khi đủ ${row.completedBusCount}/${row.busCount} xe hoàn thành chặng`
        : undefined;

      return (
        <div className="td-content">
          <select
            className={`form-select form-select-sm ${isLocked ? 'table-control-muted' : ''}`}
            value={row.status}
            disabled={isLocked}
            title={lockMessage}
            onChange={(e) => handleCellChange(row.localId, 'status', e.target.value as RoundStatus)}
          >
            <option value="DOING">Đang diễn ra</option>
            <option value="DONE">Hoàn thành</option>
          </select>
        </div>
      );
    },
  },
  {
    header: 'Số khách check-in',
    key: 'transactionCount',
    width: '104px',
    render: (row) => (row.id ? `${row.transactionCount}/${row.passengerCount}` : '-'),
  },
  {
    header: 'Số khách check-out',
    key: 'checkOutCount',
    width: '104px',
    render: (row) => (row.id ? `${row.checkOutCount ?? 0}/${row.passengerCount}` : '-'),
  },
  {
    header: 'Xe hoàn thành chặng',
    key: 'completedBusCount',
    render: (row) => (row.id ? `${row.completedBusCount ?? 0}/${row.busCount ?? 0}` : '-'),
    width: '126px',
  },
 // ===== KHÓA LƯỢT ĐI =====
  {
    header: 'Xe đã xác nhận lượt đi',
    key: 'lockedInCount',

    render: (row) =>
      row.id ? (
        <div className="d-flex align-items-center gap-2">
          <span>{row.lockedInCount ?? 0}</span>

          {(row.lockedInCount ?? 0) > 0 && (
            <button
              className="btn btn-sm btn-outline-secondary"
              title="Xem danh sách xe đã khóa lượt đi"
              onClick={() =>
                openLocksForRound?.(
                  Number(row.id),
                  'check_in'
                )
              }
            >
              <Lock size={14} />
            </button>
          )}
        </div>
      ) : (
        '-'
      ),

    width: '132px',
  },

  // ===== KHÓA LƯỢT VỀ =====
  {
    header: 'Xe đã xác nhận lượt về',
    key: 'lockedOutCount',

    render: (row) =>
      row.id ? (
        <div className="d-flex align-items-center gap-2">
          <span>{row.lockedOutCount ?? 0}</span>

          {(row.lockedOutCount ?? 0) > 0 && (
            <button
              className="btn btn-sm btn-outline-secondary"
              title="Xem danh sách xe đã khóa lượt về"
              onClick={() =>
                openLocksForRound?.(
                  Number(row.id),
                  'check_out'
                )
              }
            >
              <Lock size={14} />
            </button>
          )}
        </div>
      ) : (
        '-'
      ),

    width: '132px',
  },
  {
  header: 'Thao tác',
  key: 'actions',
  width: '64px',
  render: (row) => (
    <div className="d-flex justify-content-center align-items-center">
      <button 
        className="btn-action-delete" 
        onClick={() => handleDeleteRow(row)} 
        title="Xóa chặng"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
},
];
