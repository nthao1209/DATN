import React from 'react';
import { Trash2 } from 'lucide-react';

type PassengerMobileRow = {
  id?: number;
  localId: string;
  name: string;
  tel: string;
  note: string;
  tripId: number | null;
  busId: number | null;
  busCode?: string;
};

type PassengerMobileViewProps = {
  rows: PassengerMobileRow[];
  trips: any[];
  busesByTrip: Record<number, any[]>;
  onDeleteRow: (row: PassengerMobileRow) => void;
  onCellChange: <K extends keyof PassengerMobileRow>(localId: string, key: K, value: PassengerMobileRow[K]) => void;
};

const PassengerMobileView: React.FC<PassengerMobileViewProps> = ({
  rows,
  trips,
  busesByTrip,
  onDeleteRow,
  onCellChange,
}) => {
  return (
    <div className="d-grid gap-3">
      {rows.map((row, index) => (
        <div key={row.localId} className="card app-dark-surface border-0 shadow-sm passenger-mobile-card">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small text-muted">Dòng {index + 1}</div>
                <div className="fw-bold">{row.id ? `#${row.id}` : 'Mới'}</div>
              </div>
              <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteRow(row)}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Họ và tên</label>
              <input className="form-control" value={row.name} onChange={(e) => onCellChange(row.localId, 'name', e.target.value)} placeholder="Nhập tên" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Số điện thoại</label>
              <input className="form-control" inputMode="numeric" maxLength={10} pattern="^[1-9][0-9]{9}$" value={row.tel} onChange={(e) => onCellChange(row.localId, 'tel', e.target.value.replace(/\D/g, ''))} placeholder="Nhập SĐT" />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Trip</label>
              <select
                className="form-select"
                value={row.tripId ?? ''}
                onChange={(e) => {
                  const nextTripId = e.target.value ? Number(e.target.value) : null;
                  onCellChange(row.localId, 'tripId', nextTripId);
                  onCellChange(row.localId, 'busId', null);
                  onCellChange(row.localId, 'busCode', '');
                }}
              >
                <option value="">-- Chọn trip --</option>
                {trips.map((trip: any) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Chọn xe</label>
              <select
                className="form-select"
                value={row.busId ?? ''}
                onChange={(e) => {
                  const nextBusId = e.target.value ? Number(e.target.value) : null;
                  const options = row.tripId ? (busesByTrip[row.tripId] || []) : [];
                  const nextBus = options.find((bus: any) => Number(bus.id) === nextBusId);
                  onCellChange(row.localId, 'busId', nextBusId);
                  onCellChange(row.localId, 'busCode', nextBus?.busCode || '');
                }}
                disabled={!row.tripId}
              >
                <option value="">-- Chọn xe --</option>
                {(row.tripId ? (busesByTrip[row.tripId] || []) : []).map((bus: any) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.busCode} - {bus.registrationNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Ghi chú</label>
              <input className="form-control" value={row.note} onChange={(e) => onCellChange(row.localId, 'note', e.target.value)} placeholder="Ghi chú" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PassengerMobileView;
