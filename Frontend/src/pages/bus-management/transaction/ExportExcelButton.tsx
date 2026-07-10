import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSnackbar } from 'notistack';
import type { BusOption, DraftCell, PassengerRow, RoundOption, TripOption } from './types';
import './ExportExcelButton.css';

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
  const { enqueueSnackbar } = useSnackbar();

  const busLabelById = new Map(
    buses.map((bus) => [
      Number(bus.id),
      bus.busCode || bus.registrationNumber || '',
    ])
  );

  const getKnownBusId = (busId?: number | null) => {
    if (!busId) return null;
    return busLabelById.has(Number(busId)) ? Number(busId) : null;
  };

  const getBusLabel = (busId?: number | null, fallbackLabel = '') => {
    if (!busId) return fallbackLabel;
    return busLabelById.get(Number(busId)) || fallbackLabel;
  };

  const getActualBusId = (
    cellBusId?: number | null,
    fallbackBusId?: number | null
  ) => {
    return getKnownBusId(cellBusId) || getKnownBusId(fallbackBusId) || fallbackBusId || null;
  };

  const getAttendanceInfo = (
    isPresent: boolean,
    actualBusId?: number | null,
    assignedBusId?: number | null,
    actualBusLabel = ''
  ) => {
    if (!isPresent) {
      return {
        label: 'Không',
        isPresent: false,
        isMismatch: false,
      };
    }

    const isMismatch = Boolean(
      assignedBusId && actualBusId && Number(assignedBusId) !== Number(actualBusId)
    );

    if (!isMismatch) {
      return {
        label: 'Có',
        isPresent: true,
        isMismatch: false,
      };
    }

    const busLabel = getBusLabel(actualBusId, actualBusLabel);
    return {
      label: busLabel ? `Có (sai xe - khách đang ở trên ${busLabel})` : 'Có (sai xe)',
      isPresent: true,
      isMismatch: true,
    };
  };

  const handleExportExcel = () => {
    if (!visiblePassengers.length) {
      enqueueSnackbar('Không có dữ liệu để xuất file', { variant: 'warning' });
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

          const checkInBusId = getActualBusId(
            cell?.checkInBusId ?? cell?.busId ?? null,
            passenger.busId
          );
          const checkOutBusId = getActualBusId(
            cell?.checkOutBusId ?? cell?.busId ?? null,
            passenger.busId
          );
          const actualBusLabel = passenger.busName || getBusLabel(passenger.busId);
          const checkInKey = `${roundLabel} - Lượt đi`;
          const checkOutKey = `${roundLabel} - Lượt về`;
          const checkInInfo = getAttendanceInfo(
            Boolean(cell?.checkIn),
            checkInBusId,
            assignedBusId,
            actualBusLabel
          );
          const checkOutInfo = getAttendanceInfo(
            Boolean(cell?.checkOut),
            checkOutBusId,
            assignedBusId,
            actualBusLabel
          );

          baseRow[checkInKey] = checkInInfo.label;
          baseRow[`${roundLabel} - Ghi chú lượt đi`] = cell?.checkInNote?.trim() || '';
          baseRow[checkOutKey] = checkOutInfo.label;
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
          { wch: 36 },
          { wch: 28 },
          { wch: 36 },
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
      enqueueSnackbar('Đã xuất file Excel thành công', { variant: 'success' });
    } catch {
      enqueueSnackbar('Xuất file Excel thất bại', { variant: 'error' });
    }
  };

  const isBtnDisabled = disabled || !visiblePassengers.length;

  return (
    <button
      type="button"
      className="btn-custom-export"
      onClick={handleExportExcel}
      disabled={isBtnDisabled}
    >
      <Download size={14} />
      <span className="d-none d-lg-inline">Xuất file Excel</span>
    </button>
  );
};

export default ExportExcelButton;
