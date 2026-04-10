import React from 'react';
import { Trash2 } from 'lucide-react';

type TripStatus = 'DOING' | 'DONE';

type TripMobileRow = {
  id?: number;
  localId: string;
  name: string;
  status: TripStatus;
  busCount: number;
  roundCount: number;
};

type TripMobileViewProps = {
  rows: TripMobileRow[];
  onDeleteRow: (row: TripMobileRow) => void;
  onCellChange: <K extends keyof TripMobileRow>(localId: string, key: K, value: TripMobileRow[K]) => void;
  onManageBuses: (tripId: number) => void;
  onManageRounds: (tripId: number) => void;
};

const TripMobileView: React.FC<TripMobileViewProps> = ({
  rows,
  onDeleteRow,
  onCellChange,
  onManageBuses,
  onManageRounds,
}) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                <div className="fw-bold">{row.id ? `Trip #${row.id}` : 'Mới'}</div>
              </div>
              <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Tên chuyến</label>
              <input className="form-control" value={row.name} onChange={(e) => onCellChange(row.localId, 'name', e.target.value)} placeholder="Nhập tên chuyến" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Trạng thái</label>
              <select className="form-select" value={row.status} onChange={(e) => onCellChange(row.localId, 'status', e.target.value as TripStatus)}>
                <option value="DOING">Đang diễn ra</option>
                <option value="DONE">Hoàn thành</option>
              </select>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="text-center p-2 app-dark-soft rounded">
                  <div className="text-muted small">Số xe</div>
                  <div className="fw-bold text-info">{row.busCount}</div>
                  {row.id && (
                    <button className="btn btn-link btn-sm mt-1" onClick={() => onManageBuses(row.id!)}>
                      Quản lý
                    </button>
                  )}
                </div>
              </div>
              <div className="col-6">
                <div className="text-center p-2 app-dark-soft rounded">
                  <div className="text-muted small">Số round</div>
                  <div className="fw-bold text-info">{row.roundCount}</div>
                  {row.id && (
                    <button className="btn btn-link btn-sm mt-1" onClick={() => onManageRounds(row.id!)}>
                      Quản lý
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TripMobileView;
