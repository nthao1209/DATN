import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { BusesByTrip, PassengerRow, PassengerTrip } from './types';

type BuildPassengerColumnsParams = {
  trips: PassengerTrip[];
  busesByTrip: BusesByTrip;
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
  handleCellChange,
  handleDeleteRow,
}: BuildPassengerColumnsParams): Column<PassengerRow>[] => [
  {
    header: 'STT',
    key: 'stt',
    render: (_row, index) => index + 1,
  },
  {
    header: 'Họ và tên',
    key: 'name',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.name}
        onChange={(e) => handleCellChange(row.localId, 'name', e.target.value)}
        placeholder="Nhập tên"
      />
    ),
  },
  {
    header: 'Số điện thoại',
    key: 'tel',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        inputMode="numeric"
        maxLength={10}
        pattern="^[1-9][0-9]{9}$"
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
      render: (row: PassengerRow) => (
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
        >
          <option value="">-- Chọn xe --</option>
          {tripBuses.map((bus) => (
            <option key={bus.id} value={bus.id}>
              {bus.busCode}
            </option>
          ))}
        </select>
      ),
    } as Column<PassengerRow>;
  }),
  {
    header: 'Ghi chú',
    key: 'note',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.note}
        onChange={(e) => handleCellChange(row.localId, 'note', e.target.value)}
        placeholder="Ghi chú"
      />
    ),
  },
  {
    header: 'Thao tác',
    key: 'actions',
    render: (row) => (
      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRow(row)}>
        <Trash2 size={14} />
      </button>
    ),
  },
];
