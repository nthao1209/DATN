import type { Dispatch, SetStateAction } from 'react';
import type { OptionsObject, SnackbarKey, SnackbarMessage } from 'notistack';
import type { PassengerImportPreviewRow, PassengerRow } from './types';
import { createEmptyPassengerRow, isNewPassengerRowDirty } from './helpers';

type EnqueueSnackbar = (
  message: SnackbarMessage,
  options?: OptionsObject
) => SnackbarKey;

type UsePassengerImportPreviewParams = {
  setRows: Dispatch<SetStateAction<PassengerRow[]>>;
  enqueueSnackbar: EnqueueSnackbar;
  selectedTripId: number | null;
  selectedBusId: number | null;
};

const normalizeForComparison = (text: string) => (text || '').trim().toLowerCase();

export const usePassengerImportPreview = ({
  setRows,
  enqueueSnackbar,
  selectedTripId,
  selectedBusId,
}: UsePassengerImportPreviewParams) => {
  const handleImportedPreview = (payload: { rows: PassengerImportPreviewRow[] }) => {
    setRows((prev) => {
      const keptRows = prev.filter((row) => row.id || isNewPassengerRowDirty(row));

      const isDuplicate = (importedRow: PassengerRow) => {
        const importedNameNorm = normalizeForComparison(importedRow.name);
        const importedTelNorm = normalizeForComparison(importedRow.tel);
        const importedNoteNorm = normalizeForComparison(importedRow.note);
        const importedBusId = importedRow.busId;

        return keptRows.some((existing) => (
          importedNameNorm === normalizeForComparison(existing.name) &&
          importedTelNorm === normalizeForComparison(existing.tel) &&
          importedNoteNorm === normalizeForComparison(existing.note) &&
          importedBusId === existing.busId
        ));
      };

      const importedRowsRaw: PassengerRow[] = payload.rows.map((row, index) => ({
        localId: row.localId || `excel_${Date.now()}_${index}`,
        name: row.name || '',
        tel: row.tel || '',
        note: row.note || '',
        tripId: row.tripId ?? selectedTripId,
        busId: row.busId ?? selectedBusId ?? null,
        busCode: row.busCode || '',
      }));

      const importedRows = importedRowsRaw.filter((row) => !isDuplicate(row));
      const skippedCount = importedRowsRaw.length - importedRows.length;

      if (skippedCount > 0) {
        enqueueSnackbar(
          `Đã bỏ qua ${skippedCount} dòng vì trùng dữ liệu (tên + sdt + số xe + ghi chú)`,
          { variant: 'warning' }
        );
      }

      const nextRows = [...keptRows, ...importedRows];
      if (!nextRows.length) nextRows.push(createEmptyPassengerRow(selectedTripId, selectedBusId));

      return nextRows;
    });
  };

  return { handleImportedPreview };
};
