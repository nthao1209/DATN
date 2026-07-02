import PassengerActionButtons from '../../../components/PassengerActionButtons';
import type { Column } from '../../../components/DataTable';
import type { DraftCell, RoundOption, TransactionTableRow } from './types';
import { AutoResizeTextarea } from '../../../hooks/useAutoResize';

type BuildColumnsParams = {
  selectedRounds: RoundOption[];
  displayMode?: 'all' | 'checkIn' | 'checkOut';
  getCell: (passengerId: number, roundId: number) => DraftCell | null;
  setCell: (payload: Partial<DraftCell>) => void;
  isLocked: (
    passengerId: number,
    assignedBusId: number | null,
    roundId: number,
    type: 'checkIn' | 'checkOut'
  ) => boolean;
  onRemovePassenger?: (row: TransactionTableRow) => void;
  canRemovePassenger?: (row: TransactionTableRow) => boolean;
};

export const buildTransactionColumns = ({
  selectedRounds,
  displayMode = 'all',
  getCell,
  setCell,
  isLocked,
  onRemovePassenger,
  canRemovePassenger,
}: BuildColumnsParams): Column<TransactionTableRow>[] => {
  const dynamicRoundCols: Column<TransactionTableRow>[] = selectedRounds.flatMap((round) => {
    const roundId = Number(round.id);
    const roundLabel = round.name || `Round ${round.id}`;

    const checkInCol: Column<TransactionTableRow> = {
      header: `${roundLabel} - Lượt đi`,
      key: `round_${roundId}_checkin`,
      width: '132px',
      render: (row) => {
        const current = getCell(row.id, roundId);

        const checkIn = Boolean(current?.checkIn);
        const checkOut = Boolean(current?.checkOut);

        const locked = isLocked(
          row.id,
          row.busId,
          roundId,
          'checkIn'
        );

        return (
          <div className="transaction-attendance-cell d-flex flex-column gap-2 align-items-center">
            <input
              className={`transaction-check-input ${locked ? 'table-control-muted' : ''}`}
              type="checkbox"
              checked={checkIn}
              disabled={locked}
              onChange={(e) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,
                  checkIn: e.target.checked,
                  checkOut,
                  checkInNote: current?.checkInNote || '',
                  checkOutNote: current?.checkOutNote || '',
                  checkInBusId: row.busId,
                  ...(current?.checkOutBusId ? { checkOutBusId: current.checkOutBusId } : {}),
                  checkInTouched: true,
                });
              }}
            />

            <AutoResizeTextarea
              className="form-control form-control-sm transaction-note-input"
              value={current?.checkInNote || ''}
              placeholder="Ghi chú lượt đi"
              disabled={locked}
              onChange={(e) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,

                  checkIn,
                  checkOut,
                  checkInNote: e.target.value,
                  checkOutNote: current?.checkOutNote || '',
                  checkInBusId: current?.checkInBusId ?? row.busId,
                  ...(current?.checkOutBusId ? { checkOutBusId: current.checkOutBusId } : {}),
                  checkInNoteTouched: true,
                });
              }}
            />
          </div>
        );
      },
    };

    const checkOutCol: Column<TransactionTableRow> = {
      header: `${roundLabel} - Lượt về`,
      key: `round_${roundId}_checkout`,
      width: '132px',
      render: (row) => {
        const current = getCell(row.id, roundId);

        const checkIn = Boolean(current?.checkIn);
        const checkOut = Boolean(current?.checkOut);

        const locked = isLocked(
          row.id,
          row.busId,
          roundId,
          'checkOut'
        );

        return (
          <div className="transaction-attendance-cell d-flex flex-column gap-2 align-items-center">
            <input
              className={`transaction-check-input ${locked ? 'table-control-muted' : ''}`}
              type="checkbox"
              checked={checkOut}
              disabled={locked}
              onChange={(e) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,
                  checkIn,
                  checkOut: e.target.checked,      
                  checkInNote: current?.checkInNote || '',
                  checkOutNote: current?.checkOutNote || '',
                  ...(current?.checkInBusId ? { checkInBusId: current.checkInBusId } : {}),
                  checkOutBusId: row.busId,
                  checkOutTouched: true,
                });
              }}
            />

            <AutoResizeTextarea
              className="form-control form-control-sm transaction-note-input"
              value={current?.checkOutNote || ''}
              placeholder="Ghi chú lượt về"
              disabled={locked}
              onChange={(e) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,

                  checkIn,
                  checkOut,
                  checkInNote: current?.checkInNote || '',
                  checkOutNote: e.target.value,
                  ...(current?.checkInBusId ? { checkInBusId: current.checkInBusId } : {}),
                  checkOutBusId: current?.checkOutBusId ?? row.busId,
                  checkOutNoteTouched: true,
                });
              }}
            />
          </div>
        );
      },
    };

    if (displayMode === 'checkIn') return [checkInCol];
    if (displayMode === 'checkOut') return [checkOutCol];

    return [checkInCol, checkOutCol];
  });

  return [
    {
      header: 'STT',
      key: 'stt',
      width: '44px',
      render: (_row, idx) => idx + 1,
    },

    {
      header: 'Họ và tên',
      key: 'name',
      width: '180px',
      render: (row) => <span className="fw-semibold">{row.name}</span>,
    },

    {
      header: 'Liên lạc',
      key: 'contact',
      width: '150px',
      render: (row) => {
        return (
          <div className="transaction-contact-cell d-flex align-items-center justify-content-between gap-2">
            <div className="d-flex flex-column gap-1 overflow-hidden">
              <div className="transaction-contact-phone fw-bold">
                {row.tel || '-'}
              </div>

              <div className="transaction-bus-badge px-2 py-0.5 rounded-pill shadow-sm">
                <span className="transaction-bus-badge-text">
                  Biên chế: {row.assignedBusName || row.busName || 'N/A'}
                </span>
              </div>
            </div>

            {row.tel ? (
              <div className="d-flex gap-1">
                <PassengerActionButtons
                  passenger={{
                    name: row.name,
                    phone: row.tel,
                  }}
                  compact
                />
              </div>
            ) : null}
          </div>
        );
      },
    },

    {
      header: 'Ghi chú hồ sơ',
      key: 'passengerNote',
      width: '160px',
      render: (row) => {
        const note = (row.note || '').trim();

        return note ? (
          <span className="transaction-profile-note">{note}</span>
        ) : (
          <span className="text-muted">-</span>
        );
      },
    },

    ...dynamicRoundCols,

    {
      header: 'Thao tác',
      key: 'actions',
      width: '76px',
      render: (row) => {
        const canRemove = canRemovePassenger
          ? canRemovePassenger(row)
          : true;

        return (
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            disabled={!canRemove}
            title={
              canRemove
                ? 'Xóa khách khỏi transaction'
                : 'Chỉ được xóa khách thuộc biên chế xe khác'
            }
            onClick={() => onRemovePassenger?.(row)}
          >
            Xóa
          </button>
        );
      },
    },
  ];
};
