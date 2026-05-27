import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSnackbar } from 'notistack';
import { useTheme } from '../../../theme/ThemeContext';
import type { BusOption, DraftCell, PassengerRow, RoundOption, TripOption } from './types';

interface ExportExcelButtonProps {
  visiblePassengers: PassengerRow[];
  selectedRounds: RoundOption[];
  trips: TripOption[];
  selectedTripId: number | null;
  buses: BusOption[];
  getCell: (passengerId: number, roundId: number) => DraftCell | null;
  disabled?: boolean;
}

const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  visiblePassengers,
  selectedRounds,
  trips,
  selectedTripId,
  buses,
  getCell,
  disabled
}) => {
  const { colors } = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const busLabelById = new Map(
    buses.map((bus) => [
      Number(bus.id),
      bus.busCode || bus.registrationNumber || `Xe #${bus.id}`,
    ])
  );

  const getBusLabel = (busId?: number | null) => {
    if (!busId) return '';
    return busLabelById.get(Number(busId)) || `Xe #${busId}`;
  };

  const getAttendanceLabel = (cell: DraftCell | null, assignedBusId?: number | null) => {
    if (!cell) return 'Không';

    const present = Boolean(cell.checkIn || cell.checkOut);
    if (!present) return 'Không';

    const isMismatch = Boolean(
      assignedBusId && cell.busId && Number(assignedBusId) !== Number(cell.busId)
    );

    return isMismatch ? 'Có (sai xe)' : 'Có (đúng xe)';
  };

  const handleExportExcel = () => {
    if (!visiblePassengers.length) {
      enqueueSnackbar('Không có dữ liệu để export', { variant: 'warning' });
      return;
    }

    try {
      const selectedTrip = trips.find((trip) => Number(trip.id) === Number(selectedTripId));
      const tripName = selectedTrip?.name || `trip_${selectedTripId ?? 'unknown'}`;

      const exportRows = visiblePassengers.map((passenger, index) => {
        const baseRow: Record<string, string | number> = {
          STT: index + 1,
          'Họ và tên': passenger.name || '',
          'Số điện thoại': passenger.tel || '',
          'Xe biên chế': passenger.assignedBusName || '',
        };

        selectedRounds.forEach((round) => {
          const roundId = Number(round.id);
          const roundLabel = round.name || `Lượt ${roundId}`;
          const cell = getCell(passenger.id, roundId);
          const assignedBusId = passenger.assignedBusId ?? null;

          baseRow[`${roundLabel} - Lượt đi`] = cell?.checkIn
            ? getAttendanceLabel(cell, assignedBusId)
            : 'Không';
          baseRow[`${roundLabel} - Xe lượt đi`] = cell?.checkIn ? getBusLabel(cell?.busId) : '';
          baseRow[`${roundLabel} - Ghi chú lượt đi`] = cell?.checkInNote?.trim() || '';
          baseRow[`${roundLabel} - Lượt về`] = cell?.checkOut
            ? getAttendanceLabel(cell, assignedBusId)
            : 'Không';
          baseRow[`${roundLabel} - Xe lượt về`] = cell?.checkOut ? getBusLabel(cell?.busId) : '';
          baseRow[`${roundLabel} - Ghi chú lượt về`] = cell?.checkOutNote?.trim() || '';
        });

        return baseRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      // Set độ rộng cột
      worksheet['!cols'] =[
        { wch: 6 },
        { wch: 28 },
        { wch: 16 },
        { wch: 20 },
        ...selectedRounds.flatMap(() =>[
          { wch: 18 },
          { wch: 20 },
          { wch: 28 },
          { wch: 18 },
          { wch: 20 },
          { wch: 28 },
        ]),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

      // Tên file an toàn không chứa kí tự đặc biệt
      const safeTripName = tripName
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_');

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const fileName = `Bảng điểm danh_${safeTripName}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      enqueueSnackbar('Đã export file Excel thành công', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Export Excel thất bại', { variant: 'error' });
    }
  };

  const isBtnDisabled = disabled || !visiblePassengers.length;

  return (
    <button
      className="btn-custom-action-save shadow-sm"
      onClick={handleExportExcel}
      disabled={isBtnDisabled}
      style={{
        backgroundColor: !isBtnDisabled ? colors.info : colors.surfaceLight,
        color: !isBtnDisabled ? '#fff' : colors.textMuted,
      }}
    >
      <Download size={18} />
      <span className="d-none d-sm-inline">Export Excel</span>
    </button>
  );
};

export default ExportExcelButton;