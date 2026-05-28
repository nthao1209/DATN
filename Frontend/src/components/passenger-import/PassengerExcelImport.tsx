import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import api from '../../services/api';
import type { PassengerImportPreviewResponse } from '../../pages/admin/passenger/types';
import { useSnackbar } from 'notistack';
import { useTheme } from  '../../theme/ThemeContext';


type PassengerExcelImportProps = {
  selectedTripId: number | null;
  disabled?: boolean;
  resetToken?: number;
  onImported: (payload: PassengerImportPreviewResponse) => void;
};

const PassengerExcelImport: React.FC<PassengerExcelImportProps> = ({
  selectedTripId,
  disabled = false,
  resetToken = 0,
  onImported,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResultText, setLastResultText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const { enqueueSnackbar } = useSnackbar();

  const { isDarkMode, colors } = useTheme();

  React.useEffect(() => {
    setLastResultText('');
    setSelectedFile(null);
    setSheetNames([]);
    setSelectedSheet('');
  }, [selectedTripId, resetToken]);

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
      setSelectedFile(file);
      const result = await api.getPassengerImportSheets(String(selectedTripId), file);

      // Backend may return { sheets }, { sheetName } or { sheetNames }
      const rAny: any = result;
      const sheets = (rAny && (rAny.sheets || rAny.sheetName || rAny.sheetNames)) || [];
      setSheetNames(sheets);
      onImported({ rows: [] } as any);
      if (sheets.length > 0) {
          setSelectedSheet(sheets[0]);
      }
      enqueueSnackbar(
        `Đã tải lên file "${file.name}". Chọn sheet để xem trước dữ liệu trước khi import.`,
        { variant: 'success' }
      )
    } catch (error: any) {
        enqueueSnackbar(
                error?.message ||
                  'Không thể đọc file Excel',
                {
                  variant: 'error',
                }
              );
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };
   const handleImport = async () => {
    if (
      !selectedFile ||
      !selectedTripId
    ) {
      return;
    }

    if (!selectedSheet) {
      enqueueSnackbar(
        'Vui lòng chọn sheet',
        {
          variant: 'warning',
        }
      );

      return;
    }

    try {
      setIsUploading(true);

      const result =
        await api.importPassengersPreview(
          String(selectedTripId),
          selectedFile,
          selectedSheet
        );

      onImported(result);

      const unmatched =
        result.unmatchedBusValues.length;

      const text = unmatched
        ? `Đã import ${result.importedRows}/${result.totalRows} dòng. Có ${unmatched} giá trị xe chưa map.`
        : `Đã import ${result.importedRows}/${result.totalRows} dòng.`;

      setLastResultText(text);

      enqueueSnackbar(
        'Import Excel thành công',
        {
          variant: 'success',
        }
      );
    } catch (error: any) {
      enqueueSnackbar(
        error?.message ||
          'Lỗi khi import file Excel',
        {
          variant: 'error',
        }
      );
    } finally {
      setIsUploading(false);
    }
  };

return (
  <div className="d-flex align-items-center gap-2 position-relative import-container">
    <input
      ref={inputRef}
      type="file"
      className="d-none"
      accept=".xlsx,.xls"
      onChange={handleFileChange}
    />

    {/* Nút chọn file chính - Bé lại và mướt hơn */}
    <button
      type="button"
      className="btn-custom-import"
      onClick={handleOpenPicker}
      disabled={disabled || !selectedTripId || isUploading}
    >
      {isUploading ? <Upload size={14} className="spin" /> : <FileSpreadsheet size={14} />}
      <span className="d-none d-lg-inline">
        {selectedFile ? 'Đổi file' : 'Nhập Excel'}
      </span>
    </button>

    {/* Hiển thị tên file và Nút Import sheet trên cùng 1 hàng nếu đã chọn file */}
    {sheetNames.length > 0 && (
      <div className="d-flex align-items-center gap-2 animate-fade-left">
        <select
          className="form-select-custom-toolbar"
          style={{ 
            width: '220px', 
            minWidth: '120px',
            height: '34px',
            backgroundColor: isDarkMode ? colors.surfaceLight : '#fff',
            color: colors.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'visible'
          }}
          value={selectedSheet}
          onChange={(e) => setSelectedSheet(e.target.value)}
        >
          {sheetNames.map((sheet) => (
            <option key={sheet} value={sheet}>{sheet}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-primary btn-sm px-3 shadow-sm"
          style={{ height: '34px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
          onClick={handleImport}
          disabled={isUploading || !selectedSheet}
        >
          {isUploading ? '...' : 'Import'}
        </button>
      </div>
    )}

    {/* Thông báo trạng thái - Để tuyệt đối để không đẩy layout */}
    {selectedFile && !sheetNames.length && (
       <div className="position-absolute top-100 start-0 mt-1 badge text-bg-light border shadow-sm animate-fade-up" 
            style={{ fontSize: '10px', whiteSpace: 'nowrap', zIndex: 10 }}>
          📄 {selectedFile.name}
       </div>
    )}

    {lastResultText && (
       <div className="position-absolute top-100 end-0 mt-1 text-success fw-bold" 
            style={{ fontSize: '10px', zIndex: 10 }}>
          {lastResultText}
       </div>
    )}

    <style>{`
      .btn-custom-import {
        height: 34px !important;
        padding: 0 12px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        background-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'} !important;
        border: 1px solid ${colors.primary}44 !important;
        color: ${colors.primary} !important;
        transition: all 0.2s;
      }
      
      .btn-custom-import:hover:not(:disabled) {
        background-color: ${colors.primary}15 !important;
        transform: translateY(-1px);
      }

      .animate-fade-left {
        animation: fadeLeft 0.3s ease-out;
      }

      @keyframes fadeLeft {
        from { opacity: 0; transform: translateX(10px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  </div>
);
};
export default PassengerExcelImport;
