import { useEffect, useState } from 'react';
import PassengerActionButtons from '../../../components/passenger/PassengerActionButtons';
import type { Column } from '../../../components/DataTable';
import type { DraftCell, RoundOption, TransactionTableRow } from './types';
import { AutoResizeTextarea } from '../../../hooks/useAutoResize';

type BuildColumnsParams = {
  selectedRounds: RoundOption[];
  displayMode?: 'all' | 'checkIn' | 'checkOut';
  readOnly?: boolean;
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

type CommitNoteTextareaProps = {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
};

const CommitNoteTextarea = ({
  value,
  placeholder,
  disabled,
  onCommit,
}: CommitNoteTextareaProps) => {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
    }
  }, [isFocused, value]);

  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };

  return (
    <AutoResizeTextarea
      className="form-control form-control-sm transaction-note-input"
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        commit();
        setIsFocused(false);
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        }
      }}
    />
  );
};

export const buildTransactionColumns = ({
  selectedRounds,
  displayMode = 'all',
  readOnly = false,
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
      render: (row: TransactionTableRow) => {
        const current = getCell(row.id, roundId);

        const checkIn = Boolean(current?.checkIn);
        const checkOut = Boolean(current?.checkOut);

        const locked = isLocked(
          row.id,
          row.busId,
          roundId,
          'checkIn'
        );
        const disabled = locked || readOnly;

        return (
          <div className="transaction-attendance-cell d-flex flex-column gap-2 align-items-center">
            <input
              className={`transaction-check-input ${disabled ? 'table-control-muted' : ''}`}
              type="checkbox"
              checked={checkIn}
              disabled={disabled}
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

            <CommitNoteTextarea
              value={current?.checkInNote || ''}
              placeholder="Ghi chú lượt đi"
              disabled={disabled}
              onCommit={(value) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,

                  checkIn,
                  checkOut,
                  checkInNote: value,
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
      render: (row: TransactionTableRow) => {
        const current = getCell(row.id, roundId);

        const checkIn = Boolean(current?.checkIn);
        const checkOut = Boolean(current?.checkOut);

        const locked = isLocked(
          row.id,
          row.busId,
          roundId,
          'checkOut'
        );
        const disabled = locked || readOnly;

        return (
          <div className="transaction-attendance-cell d-flex flex-column gap-2 align-items-center">
            <input
              className={`transaction-check-input ${disabled ? 'table-control-muted' : ''}`}
              type="checkbox"
              checked={checkOut}
              disabled={disabled}
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

            <CommitNoteTextarea
              value={current?.checkOutNote || ''}
              placeholder="Ghi chú lượt về"
              disabled={disabled}
              onCommit={(value) => {
                if (!row.busId) return;

                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,

                  checkIn,
                  checkOut,
                  checkInNote: current?.checkInNote || '',
                  checkOutNote: value,
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
      render: (row: TransactionTableRow) => <span className="fw-semibold">{row.name}</span>,
    },

    {
      header: 'Liên lạc',
      key: 'contact',
      width: '150px',
      render: (row: TransactionTableRow) => {
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
      render: (row: TransactionTableRow) => {
        const note = (row.note || '').trim();

        return note ? (
          <span className="transaction-profile-note">{note}</span>
        ) : (
          <span className="text-muted">-</span>
        );
      },
    },

    ...dynamicRoundCols,

    ...(readOnly ? [] : [{
      header: 'Thao tác',
      key: 'actions',
      width: '76px',
      render: (row: TransactionTableRow) => {
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
    }]),
  ];
};
