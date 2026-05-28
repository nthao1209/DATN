import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, Filter, Mic, MicOff, X } from 'lucide-react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useTheme } from '../theme/ThemeContext';

export interface FilterConfig {
  label: string;
  key: string;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: { label: string; value: any }[];
}

interface TableActionBarProps {
  onSearch: (val: string) => void;
  onAdd?: () => void;
  filters?: FilterConfig[];
  onFilterChange?: (key: string, value: string) => void;
}

const TableActionBar: React.FC<TableActionBarProps> = ({
  onSearch, onAdd , filters, onFilterChange
}) => {
  const { colors, effects } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false); 
  const [searchValue, setSearchValue] = useState('');
  const onSearchRef = useRef(onSearch);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    onSearchRef.current(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (listening) {
      setSearchValue(transcript);
    }
  }, [listening, transcript]);

  const handleVoiceSearchToggle = async () => {
    if (!browserSupportsSpeechRecognition) return;

    if (listening) {
      SpeechRecognition.stopListening();
      setSearchValue(transcript.trim());
      return;
    }

    resetTranscript();
    setSearchValue('');

    try {
      await SpeechRecognition.startListening({
        continuous: true,
        language: 'vi-VN',
      });
    } catch {
    }
  };

  const mainSearchStyle: React.CSSProperties = {
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    height: '40px',
    borderRadius: effects.borderRadius.md,
    fontSize: '0.875rem',
    transition: effects.transition,
    outline: 'none'
  };

  const actionButtonStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.surfaceLight,
    border: `1px solid ${colors.borderLight}`,
    color: colors.textSecondary,
    borderRadius: effects.borderRadius.md,
    transition: effects.transition,
    cursor: 'pointer'
  };

  const filterInputStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    fontSize: '12px',
    borderRadius: effects.borderRadius.sm,
    padding: '0.5rem 0.75rem',
    outline: 'none',
    transition: effects.transition,
    width: '100%'
  };

  return (
    <div 
      className="w-100 py-3 px-3 px-md-4" 
      style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.02)', 
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${colors.border}`
      }}
    >
      {/* Hàng 1: Search & Main Actions */}
      <div className="d-flex justify-content-between align-items-center gap-2">
        
        {/* Search Bar - Thu gọn trên mobile */}
        <div className={`flex-grow-1 transition-all ${isExpanded ? 'd-block' : 'd-none d-md-block'}`}>
          <div className="position-relative w-100" style={{ maxWidth: '400px' }}>
            <Search 
              size={18} 
              className="position-absolute top-50 translate-middle-y ms-3" 
              style={{ zIndex: 5, color: colors.textMuted }}
            />
            <input
              type="text"
              className="form-control ps-5 shadow-none custom-placeholder"
              placeholder="Tìm kiếm ..."
              style={mainSearchStyle}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = colors.primary)}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
            <button
              type="button"
              className="position-absolute top-50 translate-middle-y border-0 p-0"
              style={{
                right: '12px',
                zIndex: 5,
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                backgroundColor: listening ? colors.primary : 'transparent',
                color: listening ? colors.textPrimary : colors.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: browserSupportsSpeechRecognition ? 'pointer' : 'not-allowed',
                opacity: browserSupportsSpeechRecognition ? 1 : 0.5,
              }}
              onClick={handleVoiceSearchToggle}
              disabled={!browserSupportsSpeechRecognition}
              title={
                browserSupportsSpeechRecognition
                  ? listening
                    ? 'Dừng tìm kiếm bằng giọng nói'
                    : 'Tìm kiếm bằng giọng nói'
                  : 'Trình duyệt không hỗ trợ nhận dạng giọng nói'
              }
              aria-label={
                browserSupportsSpeechRecognition
                  ? listening
                    ? 'Dừng tìm kiếm bằng giọng nói'
                    : 'Tìm kiếm bằng giọng nói'
                  : 'Trình duyệt không hỗ trợ nhận dạng giọng nói'
              }
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>

        {/* Nút Toggle Search (Chỉ hiện trên mobile khi chưa expand) */}
        {!isExpanded && (
          <button 
            className="d-md-none border-0" 
            style={actionButtonStyle} 
            onClick={() => setIsExpanded(true)}
          >
            <Search size={18} />
          </button>
        )}

        {/* Action Buttons Group */}
        <div className={`d-flex align-items-center gap-2 ${isExpanded ? 'd-none d-md-flex' : 'd-flex'}`}>
          {onAdd && (
            <button 
              className="btn btn-sm d-flex align-items-center gap-2 px-3 fw-bold border-0" 
              style={{ 
                height: '40px', 
                borderRadius: effects.borderRadius.md,
                backgroundColor: colors.primary, 
                color: colors.textPrimary,
                boxShadow: effects.shadowGlow,
              }}
              onClick={onAdd}
            >
              <Plus size={18} /> 
              <span className="d-none d-lg-inline">Thêm mới</span>
            </button>
          )}
          

          {/* Nút Filter Toggle (Hiện trên mobile) */}
          {filters && filters.length > 0 && (
             <button 
                className="d-md-none"
                style={{...actionButtonStyle, color: isExpanded ? colors.primary : colors.textSecondary}}
                onClick={() => setIsExpanded(!isExpanded)}
             >
                <Filter size={18} />
             </button>
          )}
        </div>

        {isExpanded && (
          <button 
            className="d-md-none border-0" 
            style={actionButtonStyle} 
            onClick={() => setIsExpanded(false)}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Hàng 2: Granular Filters (Chỉ hiện khi Expanded hoặc trên màn hình lớn) */}
      {filters && filters.length > 0 && (
        <div className={`row g-3 pt-3 animate-fade-in ${isExpanded ? 'd-flex' : 'd-none d-md-flex'}`}>
          <div className="col-12">
             <div className="d-flex align-items-center gap-2 mb-1">
                <Filter size={14} style={{ color: colors.textMuted }} />
                <span className="fw-bold text-uppercase" style={{ color: colors.textMuted, fontSize: '10px', letterSpacing: '0.05rem' }}>
                  Bộ lọc chi tiết
                </span>
             </div>
          </div>
          {filters.map((f, idx) => (
            <div key={idx} className="col-12 col-sm-6 col-md-3 col-lg-2">
              <div className="filter-group">
                <label className="mb-1 d-block ps-1 fw-medium" style={{ fontSize: '11px', color: colors.textMuted }}>
                  {f.label}
                </label>
                {f.type === 'select' ? (
                  <select 
                    className="form-select form-select-sm shadow-none"
                    style={filterInputStyle}
                    onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                  >
                    <option value="" style={{ background: colors.surface }}>Tất cả</option>
                    {f.options?.map(opt => (
                      <option key={opt.value} value={opt.value} style={{ background: colors.surface }}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm shadow-none custom-placeholder"
                    style={filterInputStyle}
                    placeholder={f.placeholder || 'Nhập...'}
                    onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
      .custom-placeholder::placeholder {
          color: ${colors.textMuted} !important;
          opacity: 0.7;
          font-size: 0.85rem;
        }

        .custom-placeholder::-webkit-input-placeholder { color: ${colors.textMuted} !important; }
        .custom-placeholder::-moz-placeholder { color: ${colors.textMuted} !important; }
        .custom-placeholder:-ms-input-placeholder { color: ${colors.textMuted} !important; }

        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .transition-all { transition: all 0.3s ease-in-out; }
      `}</style>
    </div>
  );
};

export default TableActionBar;