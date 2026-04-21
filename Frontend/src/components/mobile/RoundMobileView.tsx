import React from 'react';
import { Trash2 } from 'lucide-react';

type RoundStatus = 'DOING' | 'DONE';

type RoundMobileRow = {
  id?: number;
  localId: string;
  name: string;
  time: string;
  status: RoundStatus;
  transactionCount: number;
};

type RoundMobileViewProps = {
  rows: RoundMobileRow[];
  onDeleteRow: (row: RoundMobileRow) => void;
  onCellChange: <K extends keyof RoundMobileRow>(localId: string, key: K, value: RoundMobileRow[K]) => void;
};

const RoundMobileView: React.FC<RoundMobileViewProps> = ({ rows, onDeleteRow, onCellChange }) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                <div className="fw-bold">{row.id ? `Round #${row.id}` : 'Mới'}</div>
              </div>
              <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">TÊN CHẶNG</label>
              <input className="form-control" value={row.name} onChange={(e) => onCellChange(row.localId, 'name', e.target.value)} placeholder="Nhập tên chặng" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">THỜI GIAN</label>
              <input className="form-control" value={row.time} onChange={(e) => onCellChange(row.localId, 'time', e.target.value)} placeholder="Ví dụ: 08:00" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">TÌNH TRẠNG</label>
              <select className="form-select" value={row.status} onChange={(e) => onCellChange(row.localId, 'status', e.target.value as RoundStatus)}>
                <option value="DOING">Đang diễn ra</option>
                <option value="DONE">Hoàn thành</option>
              </select>
            </div>

            <div className="text-center p-2 app-dark-soft rounded">
              <div className="text-muted small">SỐ CHECK-IN</div>
              <div className="fw-bold text-info">{row.transactionCount}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoundMobileView;
