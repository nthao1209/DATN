import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSnackbar } from 'notistack';
import { useTheme } from '../../theme/ThemeContext';
import type { PassengerRow, PassengerTrip } from '../../pages/admin/passenger/types';

type PassengerExcelExportProps = {
  rows: PassengerRow[];
  trips: PassengerTrip[];
  selectedTripId: number | null;
  disabled?: boolean;
};

const PassengerExcelExport: React.FC<PassengerExcelExportProps> = ({
  rows,
  trips,
  selectedTripId,
  disabled = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { isDarkMode, colors } = useTheme();

  const tripsToExport = React.useMemo(
    () => (selectedTripId ? trips.filter((trip) => Number(trip.id) === Number(selectedTripId)) : trips),
    [selectedTripId, trips]
  );

  const exportRows = React.useMemo(() => {
    const meaningfulRows = rows.filter((row) => {
      const hasText = Boolean((row.name || '').trim() || (row.tel || '').trim() || (row.note || '').trim());
      const hasAssignment = Boolean(row.tripId || row.busId || row.busCode || Object.keys(row.tripAssignments || {}).length);
      return hasText || hasAssignment;
    });

    return meaningfulRows.map((row, index) => {
      const baseRow: Record<string, string | number> = {
        STT: index + 1,
        'Họ và tên': row.name || '',
        'Số điện thoại': row.tel || '',
        'Ghi chú': row.note || '',
      };

      tripsToExport.forEach((trip) => {
        const tripId = Number(trip.id);
        const assignment = row.tripAssignments?.[tripId];
        const busCode = assignment?.busCode || (row.tripId === tripId ? row.busCode || '' : '');
        baseRow[String(trip.name)] = busCode;
      });

      return baseRow;
    });
  }, [rows, tripsToExport]);

  const handleExport = () => {
    if (!exportRows.length) {
      enqueueSnackbar('Không có dữ liệu để export', { variant: 'warning' });
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 16 },
        { wch: 28 },
        ...tripsToExport.map(() => ({ wch: 18 })),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Passengers');

      const selectedTrip = trips.find((trip) => Number(trip.id) === Number(selectedTripId));
      const tripName = selectedTrip?.name || (selectedTripId ? `trip_${selectedTripId}` : 'all_trips');
      const safeTripName = tripName.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const fileName = `Danh_sach_hanh_khach_${safeTripName}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      enqueueSnackbar('Đã export file Excel thành công', { variant: 'success' });
    } catch {
      enqueueSnackbar('Export Excel thất bại', { variant: 'error' });
    }
  };

  const isBtnDisabled = disabled || !exportRows.length;

  return (
    <button
      type="button"
      className="btn-custom-export"
      onClick={handleExport}
      disabled={isBtnDisabled}
    >
      <Download size={14} />
      <span className="d-none d-lg-inline">Export Excel</span>

      <style>{`
        .btn-custom-export {
          height: 34px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          background-color: ${isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5'} !important;
          border: 1px solid ${colors.success}44 !important;
          color: ${colors.success} !important;
          transition: all 0.2s;
        }

        .btn-custom-export:hover:not(:disabled) {
          background-color: ${colors.success}15 !important;
          transform: translateY(-1px);
        }
      `}</style>
    </button>
  );
};

export default PassengerExcelExport;