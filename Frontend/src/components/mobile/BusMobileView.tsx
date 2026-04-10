import React from 'react';
import { Trash2 } from 'lucide-react';

type BusManager = {
  id: number;
  name: string;
  description?: string | null;
};

type BusMobileRow = {
  id?: number;
  localId: string;
  busCode: string;
  registrationNumber: string;
  driverName: string;
  driverTel: string;
  tourGuideName: string;
  tourGuideTel: string;
  description: string;
  managerId: number | null;
  managerName: string;
};

type BusMobileViewProps = {
  rows: BusMobileRow[];
  managers: BusManager[];
  onDeleteRow: (row: BusMobileRow) => void;
  onCellChange: <K extends keyof BusMobileRow>(localId: string, key: K, value: BusMobileRow[K]) => void;
};

const BusMobileView: React.FC<BusMobileViewProps> = ({ rows, managers, onDeleteRow, onCellChange }) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                <div className="fw-bold">{row.id ? `Bus #${row.id}` : 'Mới'}</div>
              </div>
              <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Mã xe</label>
              <input className="form-control" value={row.busCode} onChange={(e) => onCellChange(row.localId, 'busCode', e.target.value)} placeholder="Mã xe" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Biển số xe</label>
              <input className="form-control" value={row.registrationNumber} onChange={(e) => onCellChange(row.localId, 'registrationNumber', e.target.value)} placeholder="Biển số" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Tên tài xế</label>
              <input className="form-control" value={row.driverName} onChange={(e) => onCellChange(row.localId, 'driverName', e.target.value)} placeholder="Tên tài xế" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">SĐT tài xế</label>
              <input className="form-control" inputMode="numeric" maxLength={10} pattern="^[1-9][0-9]{9}$" value={row.driverTel} onChange={(e) => onCellChange(row.localId, 'driverTel', e.target.value.replace(/\D/g, ''))} placeholder="SĐT" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Tên HDV</label>
              <input className="form-control" value={row.tourGuideName} onChange={(e) => onCellChange(row.localId, 'tourGuideName', e.target.value)} placeholder="Tên HDV" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">SĐT HDV</label>
              <input className="form-control" inputMode="numeric" maxLength={10} pattern="^[1-9][0-9]{9}$" value={row.tourGuideTel} onChange={(e) => onCellChange(row.localId, 'tourGuideTel', e.target.value.replace(/\D/g, ''))} placeholder="SĐT" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Đặc điểm</label>
              <input className="form-control" value={row.description} onChange={(e) => onCellChange(row.localId, 'description', e.target.value)} placeholder="Đặc điểm" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Trưởng xe</label>
              <select
                className="form-select"
                value={row.managerId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null;
                  const nextManager = managers.find((m) => Number(m.id) === nextId);
                  onCellChange(row.localId, 'managerId', nextId);
                  onCellChange(row.localId, 'managerName', nextManager?.name || '');
                }}
              >
                <option value="">-- Chọn --</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.description ? ` (${m.description})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BusMobileView;
