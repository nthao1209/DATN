import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSnackbar } from 'notistack';
import { useTheme } from '../../theme/ThemeContext';
import type { DraftCell, PassengerRow, RoundOption, TripOption } from './types';

interface ExportExcelButtonProps {
  visiblePassengers: PassengerRow[];
  selectedRounds: RoundOption[];
  trips: TripOption[];
  selectedTripId: number | null;
  getCell: (passengerId: number, roundId: number) => DraftCell | null;
  disabled?: boolean;
}

const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  visiblePassengers,
  selectedRounds,
  trips,
  selectedTripId,
  getCell,
  disabled
}) => {
  const { colors } = useTheme();
  const { enqueueSnackbar } = useSnackbar();

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
          'Xe điểm danh': passenger.busName || '',
          'Xe biên chế': passenger.assignedBusName || '',
        };

        selectedRounds.forEach((round) => {
          const roundId = Number(round.id);
          const roundLabel = round.name || `Lượt ${roundId}`;
          const cell = getCell(passenger.id, roundId);

          baseRow[`${roundLabel} - Lượt đi`] = cell?.checkIn ? 'Có' : 'Không';
          baseRow[`${roundLabel} - Lượt về`] = cell?.checkOut ? 'Có' : 'Không';
          baseRow[`${roundLabel} - Ghi chú lượt đi`] = cell?.checkInNote?.trim() || '';
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
        { wch: 20 },
        ...selectedRounds.flatMap(() =>[{ wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 28 }]),
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
      console.error('Export transaction excel error:', error);
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