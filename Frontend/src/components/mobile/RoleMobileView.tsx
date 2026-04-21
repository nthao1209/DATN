import React from 'react';
import { Trash2 } from 'lucide-react';

type RoleMobileRow = {
  id?: number;
  localId: string;
  name: string;
  description: string;
};

type RoleMobileViewProps = {
  rows: RoleMobileRow[];
  onDeleteRow: (row: RoleMobileRow) => void;
  onCellChange: <K extends keyof RoleMobileRow>(localId: string, key: K, value: RoleMobileRow[K]) => void;
};

const RoleMobileView: React.FC<RoleMobileViewProps> = ({ rows, onDeleteRow, onCellChange }) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                {row.id && <div className="text-muted small">ID: {row.id}</div>}
              </div>
              <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">TÊN ROLE</label>
              <input className="form-control" value={row.name} onChange={(e) => onCellChange(row.localId, 'name', e.target.value)} placeholder="Tên role" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">MÔ TẢ</label>
              <input className="form-control" value={row.description} onChange={(e) => onCellChange(row.localId, 'description', e.target.value)} placeholder="Mô tả role" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoleMobileView;
