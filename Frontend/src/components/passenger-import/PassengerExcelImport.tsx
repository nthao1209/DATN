import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import api from '../../services/api';
import type { PassengerImportPreviewResponse } from '../../pages/passenger/types';

type PassengerExcelImportProps = {
  selectedTripId: number | null;
  disabled?: boolean;
  onImported: (payload: PassengerImportPreviewResponse) => void;
};

const PassengerExcelImport: React.FC<PassengerExcelImportProps> = ({
  selectedTripId,
  disabled = false,
  onImported,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResultText, setLastResultText] = useState('');

  const handleOpenPicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedTripId) {
      event.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      const result = await api.importPassengersPreview(String(selectedTripId), file);
      onImported(result);

      const unmatched = result.unmatchedBusValues.length;
      const text = unmatched
        ? `Đã import ${result.importedRows}/${result.totalRows} dòng. Có ${unmatched} giá trị xe chưa map.`
        : `Đã import ${result.importedRows}/${result.totalRows} dòng.`;

      setLastResultText(text);
    } catch (error: any) {
      alert(error?.message || 'Lỗi khi import file Excel');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="d-flex flex-column">
      <input
        ref={inputRef}
        type="file"
        className="d-none"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-1"
        onClick={handleOpenPicker}
        disabled={disabled || !selectedTripId || isUploading}
      >
        {isUploading ? <Upload size={14} /> : <FileSpreadsheet size={14} />}
        {isUploading ? 'Đang import...' : 'Import Excel'}
      </button>
      {lastResultText ? <small className="text-muted mt-1">{lastResultText}</small> : null}
    </div>
  );
};

export default PassengerExcelImport;
