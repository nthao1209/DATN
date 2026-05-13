import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { BusesByTrip, PassengerRow, PassengerTrip } from './types';
import { AutoResizeTextarea } from '../../hooks/useAutoResize.tsx';

type BuildPassengerColumnsParams = {
  trips: PassengerTrip[];
  busesByTrip: BusesByTrip;
  readOnly?: boolean;
  handleCellChange: <K extends keyof PassengerRow>(
    localId: string,
    key: K,
    value: PassengerRow[K]
  ) => void;
  handleDeleteRow: (row: PassengerRow) => void;
};

export const buildPassengerColumns = ({
  trips,
  busesByTrip,
  readOnly = false,
  handleCellChange,
  handleDeleteRow,
}: BuildPassengerColumnsParams): Column<PassengerRow>[] => {
  const columns: Column<PassengerRow>[] = [
    {
    header: 'STT',
    key: 'stt',
    render: (_row, index) => index + 1,
  },
  {
    header: 'Họ và tên',
    key: 'name',
    width: '320px',
    render: (row) =>
      readOnly ? (
        <span className="text-white fw-semibold">{row.name || '-'}</span>
      ) : (
        <input
          className="form-control form-control-sm"
          style={{ minWidth: 280 }}
          value={row.name}
          onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
          placeholder="Nhập tên"
        />
      ),
  },
  {
    header: 'Số điện thoại',
    key: 'tel',
    render: (row) =>
      readOnly ? (
        <span className="text-white">{row.tel || '-'}</span>
      ) : (
        <input
          className="form-control form-control-sm"
          inputMode="numeric"
          maxLength={10}
          pattern="^0[0-9]{9}$"
          value={row.tel}
          onChange={(e) => handleCellChange(row.localId, 'tel', e.target.value.replace(/\D/g, ''))}
          placeholder="Nhập số điện thoại"
        />
      ),
  },
  ...trips.map((trip) => {
    const tripId = Number(trip.id);
    const tripBuses = busesByTrip[tripId] || [];

    return {
      header: String(trip.name),
      key: `trip_${tripId}`,
      render: (row: PassengerRow) => {
        if (readOnly) {
          const assignment = (row as any).tripAssignments?.[tripId];
          if (assignment) {
            return <span className="text-white">{assignment.busCode || '-'}</span>;
          }

          const busText = row.tripId === tripId ? (row.busCode || '-') : '-';
          return <span className="text-white">{busText}</span>;
        }

        return (
          <select
            className="form-select form-select-sm"
            value={row.tripId === tripId ? (row.busId ?? '') : ''}
            onChange={(e) => {
              const nextBusId = e.target.value ? Number(e.target.value) : null;
              const nextBus = tripBuses.find((bus) => Number(bus.id) === nextBusId);

              if (!nextBusId) {
                if (row.tripId === tripId) {
                  handleCellChange(row.localId, 'tripId', null);
                  handleCellChange(row.localId, 'busId', null);
                  handleCellChange(row.localId, 'busCode', '');
                }
                return;
              }

              handleCellChange(row.localId, 'tripId', tripId);
              handleCellChange(row.localId, 'busId', nextBusId);
              handleCellChange(row.localId, 'busCode', nextBus?.busCode || '');
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="">-- Chọn xe --</option>
            {tripBuses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.busCode}
              </option>
            ))}
          </select>
        );
      },
    } as Column<PassengerRow>;
  }),
  {
    header: 'Ghi chú',
    key: 'note',
    render: (row) =>
      readOnly ? (
        <span className="text-white text-wrap passenger-wrap-cell" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.note || '-'}</span>
      ) : (
        <AutoResizeTextarea
          className="form-control form-control-sm passenger-wrap-input"
          value={row.note}
          onChange={(e) => handleCellChange(row.localId, 'note', e.target.value)}
          placeholder="Ghi chú"
        />
      ),
  },
  ];

  if (!readOnly) {
    columns.push({
      header: 'Thao tác',
      key: 'actions',
      width: '100px', 
      render: (row) => (
        <div className="d-flex justify-content-center align-items-center">
          <button 
            className="btn-action-delete" 
            onClick={() => handleDeleteRow(row)} 
            title="Xóa hành khách"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    });
  }

  return columns;
};

