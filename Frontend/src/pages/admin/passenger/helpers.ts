import type { PassengerRow } from './types';

const EMPTY_ROWS_COUNT = 1;

const makePassengerLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizePassengerTel = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text.toLowerCase() === 'null' ? '' : text;
};

export const createEmptyPassengerRow = (
  selectedTripId: number | null,
  selectedBusId: number | null
): PassengerRow => ({
  localId: makePassengerLocalId(),
  name: '',
  tel: '',
  note: '',
  tripId: selectedTripId,
  busId: selectedBusId,
  busCode: '',
});

export const buildPassengersSignature = (passengers: any[] = []) =>
  passengers
    .map((passenger: any) =>
      [
        passenger.id,
        passenger.name,
        normalizePassengerTel(passenger.tel),
        passenger.note || '',
        passenger.bus?.id,
      ].join('-')
    )
    .join('|');

export const isSamePassengerRow = (current: PassengerRow, initial: PassengerRow) => {
  const currentNote = (current.note || '').trim();
  const initialNote = (initial.note || '').trim();

  return (
    current.name.trim() === initial.name.trim() &&
    current.tel.trim() === initial.tel.trim() &&
    currentNote === initialNote &&
    (current.busId ?? null) === (initial.busId ?? null)
  );
};

export const isNewPassengerRowDirty = (row: PassengerRow) => {
  const note = (row.note || '').trim();
  return Boolean(row.name.trim() || row.tel.trim() || note);
};

export const buildPassengerRows = ({
  sourcePassengers,
  selectedTripId,
  selectedBusId,
}: {
  sourcePassengers: any[];
  selectedTripId: number | null;
  selectedBusId: number | null;
}) => {
  const mapped: PassengerRow[] = sourcePassengers.map((passenger: any) => ({
    id: passenger.id,
    localId: `db_${passenger.id}`,
    name: passenger.name || '',
    tel: normalizePassengerTel(passenger.tel),
    note: passenger.note || '',
    tripId: passenger.bus?.trip?.id ? Number(passenger.bus.trip.id) : selectedTripId,
    busId: passenger.bus?.id ? Number(passenger.bus.id) : null,
    busCode: passenger.bus?.busCode || passenger.bus?.registrationNumber || '',
  }));

  const initialById: Record<number, PassengerRow> = {};
  mapped.forEach((row) => {
    if (row.id) initialById[row.id] = row;
  });

  const rows = [...mapped];
  while (rows.length < EMPTY_ROWS_COUNT) {
    rows.push({
      localId: makePassengerLocalId(),
      name: '',
      tel: '',
      note: '',
      tripId: selectedTripId,
      busId: selectedBusId,
      busCode: '',
    });
  }

  return { rows, initialById };
};

export const buildPassengerDisplayRows = (rows: PassengerRow[], isAllTripsView: boolean) => {
  if (!isAllTripsView) return rows;

  const groups: Record<string, PassengerRow & { tripAssignments?: Record<number, any> }> = {};
  const keyFor = (row: PassengerRow) =>
    `${(row.name || '').trim().toLowerCase()}||${(row.tel || '').trim().toLowerCase()}||${(row.note || '').trim().toLowerCase()}`;

  rows.forEach((row) => {
    const key = keyFor(row);
    if (!groups[key]) {
      groups[key] = {
        localId: `agg_${Object.keys(groups).length}_${Date.now()}`,
        name: row.name,
        tel: row.tel,
        note: row.note,
        tripId: null,
        busId: null,
        busCode: '',
        tripAssignments: {},
      } as any;
    }

    const tripId = row.tripId ?? 0;
    const group = groups[key];
    if (!group.tripAssignments) group.tripAssignments = {};
    if (!group.tripAssignments[tripId]) {
      group.tripAssignments[tripId] = { tripId, busCodes: new Set<string>() } as any;
    }
    if (row.busCode) (group.tripAssignments[tripId] as any).busCodes.add(row.busCode);
  });

  return Object.values(groups).map((group) => {
    const assignments: Record<number, any> = {};
    const tripAssignments = group.tripAssignments || {};

    Object.keys(tripAssignments).forEach((key) => {
      const tripId = Number(key);
      const busCodesSet: Set<string> = (tripAssignments[tripId] as any).busCodes || new Set<string>();
      assignments[tripId] = { tripId, busCode: Array.from(busCodesSet).join(', ') };
    });

    return { ...group, tripAssignments: assignments } as PassengerRow;
  });
};
