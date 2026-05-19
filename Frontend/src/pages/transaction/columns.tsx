import PassengerActionButtons from '../../components/PassengerActionButtons';
import type { Column } from '../../components/DataTable';
import type { DraftCell, RoundOption, RoundSummary, TransactionTableRow } from './types';
import { useTheme} from '../../theme/ThemeContext'; 
import { AutoResizeTextarea } from '../../hooks/useAutoResize';

type BuildColumnsParams = {
  selectedRounds: RoundOption[];
  roundSummary: RoundSummary;
  getCell: (passengerId: number, roundId: number) => DraftCell | null;
  setCell: (payload: DraftCell) => void;
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
  roundSummary,
  getCell,
  setCell,
  isLocked,
  onRemovePassenger,
  canRemovePassenger,
}: BuildColumnsParams): Column<TransactionTableRow>[] => {
  const {colors} = useTheme();
  const dynamicRoundCols: Column<TransactionTableRow>[] = selectedRounds.flatMap((round) => {
    const roundId = Number(round.id);
    const roundLabel = round.name || `Round ${round.id}`;

    const checkInCol: Column<TransactionTableRow> = {
      header: `${roundLabel} - Lượt đi`,
      key: `round_${roundId}_checkin`,
      width: '140px',
      render: (row) => {
        if (row.isSummary) {
          const stats = roundSummary[roundId] || { checkIn: 0, checkOut: 0, total: 0 };
          return <div className="fw-bold text-primary text-center">{stats.checkIn}/{stats.total}</div>;
        }

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
          <div className="d-flex justify-content-center">
            <input
              type="checkbox"
              checked={checkIn}
              disabled={locked}
              style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
              onChange={(e) => {
                if (!row.busId) return;
                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,
                  checkIn: e.target.checked,
                  checkOut,
                  checkInAt: current?.checkInAt,
                  checkInBy: current?.checkInBy,
                  checkOutAt: current?.checkOutAt,
                  checkOutBy: current?.checkOutBy,
                  note: current?.note || '',
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
      width: '140px',
      render: (row) => {
        if (row.isSummary) {
          const stats = roundSummary[roundId] || { checkIn: 0, checkOut: 0, total: 0 };
          return <div className="fw-bold text-primary text-center">{stats.checkOut}/{stats.total}</div>;
        }

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
          <div className="d-flex justify-content-center">
            <input
              type="checkbox"
              checked={checkOut}
              disabled={locked}
              style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
              onChange={(e) => {
                if (!row.busId) return;
                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,
                  checkIn,
                  checkOut: e.target.checked,
                  checkInAt: current?.checkInAt,
                  checkInBy: current?.checkInBy,
                  checkOutAt: current?.checkOutAt,
                  checkOutBy: current?.checkOutBy,
                  note: current?.note || '',
                });
              }}
            />
          </div>
        );
      },
    };

    return [checkInCol, checkOutCol];
  });

  return [
    {
      header: 'STT',
      key: 'stt',
      width: '70px',
      render: (row, idx) => (row.isSummary ? '' : idx + 1),
    },
    {
      header: 'Họ và tên',
      key: 'name',
      width: '220px',
      render: (row) =>
        row.isSummary ? <span className="fw-bold">Tổng kết</span> : <span className="fw-semibold">{row.name}</span>,
    },
    {
      header: 'Liên lạc',
      key: 'contact',
      width: '180px', // Tăng nhẹ width để thoải mái layout
      render: (row) => {
        if (row.isSummary) return <span className="text-muted">-</span>;
        
        return (
          <div className="transaction-contact-cell d-flex align-items-center justify-content-between gap-2">
            <div className="d-flex flex-column gap-1 overflow-hidden">
              <div className="transaction-contact-phone fw-bold" style={{ fontSize: '13px' }}>
                {row.tel || '-'}
              </div>
              
              {/* Badge Biên chế - Đã đổi sang màu Warning nổi bật */}
              <div 
                className="px-2 py-0.5 rounded-pill d-inline-flex align-items-center shadow-sm"
                style={{ 
                  backgroundColor: `${colors.warning}15`, // Nền vàng mờ
                  border: `1px solid ${colors.warning}44`, // Viền vàng mờ
                  width: 'fit-content'
                }}
              >
                <span style={{ color: colors.warning, fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  Biên chế: {row.assignedBusName || row.busName || 'N/A'}
                </span>
              </div>
            </div>

            {row.tel ? (
              <div className="d-flex gap-1">
                <PassengerActionButtons 
                  passenger={{ name: row.name, phone: row.tel }} 
                  compact 
                />
              </div>
            ) : null}
          </div>
        );
      },
    },
    ...dynamicRoundCols,
    {
      header: 'Ghi chú',
      key: 'note',
      width: '190px',
      render: (row) => {
        
        const noteSource = selectedRounds
          .map((round) => getCell(row.id, Number(round.id))?.note || '')
          .find((n) => n.trim().length > 0) || '';

        return (
          <AutoResizeTextarea
            className="form-control form-control-sm transaction-note-input"
            value={noteSource}
            placeholder="Ghi chú"
            onChange={(e) => {
              const nextNote = e.target.value;
              selectedRounds.forEach((round) => {
                const roundId = Number(round.id);
                const current = getCell(row.id, roundId);
                if (!row.busId) return;
                setCell({
                  transactionId: current?.transactionId,
                  passengerId: row.id,
                  roundId,
                  busId: row.busId,
                  checkIn: Boolean(current?.checkIn),
                  checkOut: Boolean(current?.checkOut),
                  checkInAt: current?.checkInAt,
                  checkInBy: current?.checkInBy,
                  checkOutAt: current?.checkOutAt,
                  checkOutBy: current?.checkOutBy,
                  note: nextNote,
                });
              });
            }}
          />
        );
      },
    },
    {
      header: 'Thao tác',
      key: 'actions',
      width: '120px',
      render: (row) => {
        if (row.isSummary) return null;
        const canRemove = canRemovePassenger ? canRemovePassenger(row) : true;
        return (
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            disabled={!canRemove}
            title={canRemove ? 'Xóa khách khỏi transaction' : 'Chỉ được xóa khách thuộc biên chế xe khác'}
            onClick={() => onRemovePassenger?.(row)}
          >
            Xóa
          </button>
        );
      },
    },
  ];
};
