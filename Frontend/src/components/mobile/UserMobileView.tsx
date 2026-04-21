import React from 'react';
import { Trash2 } from 'lucide-react';

type UserMobileRow = {
  id?: number;
  localId: string;
  email: string;
  name: string;
  createdDate: string;
  latestAccessDate: string;
  latestRole: string;
  description?: string;
};

type UserMobileViewProps = {
  rows: UserMobileRow[];
  onDeleteRow: (row: UserMobileRow) => void;
  onCellChange: <K extends keyof UserMobileRow>(localId: string, key: K, value: UserMobileRow[K]) => void;
};

const UserMobileView: React.FC<UserMobileViewProps> = ({ rows, onDeleteRow, onCellChange }) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                <div className="fw-bold text-monospace text-info">{row.email}</div>
              </div>
              {row.id && (
                <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">TÊN</label>
              <input className="form-control" value={row.name} onChange={(e) => onCellChange(row.localId, 'name', e.target.value)} placeholder="Tên user" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">GHI CHÚ</label>
              <input className="form-control" value={row.description} onChange={(e) => onCellChange(row.localId, 'description', e.target.value)} placeholder="Ghi chú" />
            </div>

            <div className="row g-2">
              <div className="col-6">
                <div className="text-center p-2 app-dark-soft rounded">
                  <div className="text-muted small">NGÀY TẠO</div>
                  <div className="fw-bold small">{row.createdDate}</div>
                </div>
              </div>
              <div className="col-6">
                <div className="text-center p-2 app-dark-soft rounded">
                  <div className="text-muted small">TRUY CẬP GẦN NHẤT</div>
                  <div className="fw-bold small">{row.latestAccessDate}</div>
                </div>
              </div>
              <div className="col-12">
                <div className="text-center p-2 app-dark-soft rounded">
                  <div className="text-muted small">ROLE</div>
                  <div className="fw-bold small text-info">{row.latestRole}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserMobileView;
