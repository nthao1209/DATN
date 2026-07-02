import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus, Filter, Mic, MicOff, X } from 'lucide-react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useTheme } from '../theme/ThemeContext';
import { usePageThemeVars } from '../hooks/usePageThemeVars';
import './TableActionBar.css';

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
  onSearch,
  onAdd,
  filters,
  onFilterChange,
}) => {
  const { colors } = useTheme();
  const pageThemeVars = usePageThemeVars();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [voicePreview, setVoicePreview] = useState('');
  const onSearchRef = useRef(onSearch);
  const voiceSessionActiveRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextSearchEffectRef = useRef(false);

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
    if (voiceSessionActiveRef.current) return;
    if (suppressNextSearchEffectRef.current) {
      suppressNextSearchEffectRef.current = false;
      return;
    }
    onSearchRef.current(searchValue);
  }, [searchValue]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const finishVoiceSearch = useCallback(
    (value?: string) => {
      const finalValue = (value ?? transcript).trim();
      clearSilenceTimer();
      voiceSessionActiveRef.current = false;

      if (listening) {
        SpeechRecognition.stopListening();
      }

      suppressNextSearchEffectRef.current = finalValue !== searchValue;
      setSearchValue(finalValue);
      setVoicePreview('');
      onSearchRef.current(finalValue);
      resetTranscript();
    },
    [clearSilenceTimer, listening, resetTranscript, searchValue, transcript]
  );

  useEffect(() => {
    if (!listening || !voiceSessionActiveRef.current) return;
    setVoicePreview(transcript);
    clearSilenceTimer();

    if (transcript.trim()) {
      silenceTimerRef.current = setTimeout(() => {
        finishVoiceSearch(transcript);
      }, 900);
    }
  }, [clearSilenceTimer, finishVoiceSearch, listening, transcript]);

  useEffect(() => {
    if (!listening && voiceSessionActiveRef.current) {
      finishVoiceSearch(transcript);
    }
  }, [finishVoiceSearch, listening, transcript]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (voiceSessionActiveRef.current) {
        SpeechRecognition.stopListening();
      }
    };
  }, [clearSilenceTimer]);

  const handleVoiceSearchToggle = async () => {
    if (!browserSupportsSpeechRecognition) return;

    if (listening) {
      finishVoiceSearch(transcript);
      return;
    }

    voiceSessionActiveRef.current = true;
    clearSilenceTimer();
    resetTranscript();
    setVoicePreview('');

    try {
      await SpeechRecognition.startListening({
        continuous: false,
        language: 'vi-VN',
      });
    } catch {
      voiceSessionActiveRef.current = false;
    }
  };

  const actionBarVars = {
    ...pageThemeVars,
    '--table-action-voice-bg': listening ? colors.primary : 'transparent',
    '--table-action-voice-color': listening ? colors.textPrimary : colors.textMuted,
    '--table-action-voice-cursor': browserSupportsSpeechRecognition ? 'pointer' : 'not-allowed',
    '--table-action-voice-opacity': browserSupportsSpeechRecognition ? '1' : '0.5',
    '--table-action-filter-toggle-color': isExpanded ? colors.primary : colors.textSecondary,
  } as React.CSSProperties;

  return (
    <div className="table-action-bar w-100 py-3 px-3 px-md-4" style={actionBarVars}>
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div className={`flex-grow-1 transition-all ${isExpanded ? 'd-block' : 'd-none d-md-block'}`}>
          <div className="table-action-search-wrap position-relative w-100">
            <Search size={18} className="table-action-search-icon position-absolute top-50 translate-middle-y ms-3" />
            <input
              type="text"
              className="table-action-search-input form-control ps-5 shadow-none custom-placeholder"
              placeholder="Tìm kiếm ..."
              value={listening ? voicePreview : searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button
              type="button"
              className="table-action-voice-btn position-absolute top-50 translate-middle-y border-0 p-0"
              onClick={handleVoiceSearchToggle}
              disabled={!browserSupportsSpeechRecognition}
              title={browserSupportsSpeechRecognition ? (listening ? 'Dừng tìm kiếm bằng giọng nói' : 'Tìm kiếm bằng giọng nói') : 'Trình duyệt không hỗ trợ nhận dạng giọng nói'}
              aria-label={browserSupportsSpeechRecognition ? (listening ? 'Dừng tìm kiếm bằng giọng nói' : 'Tìm kiếm bằng giọng nói') : 'Trình duyệt không hỗ trợ nhận dạng giọng nói'}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>

        {!isExpanded && (
          <button className="table-action-icon-btn d-md-none border-0" onClick={() => setIsExpanded(true)}>
            <Search size={18} />
          </button>
        )}

        <div className={`d-flex align-items-center gap-2 ${isExpanded ? 'd-none d-md-flex' : 'd-flex'}`}>
          {onAdd && (
            <button className="table-action-add-btn btn btn-sm d-flex align-items-center gap-2 px-3 fw-bold border-0" onClick={onAdd}>
              <Plus size={18} />
              <span className="d-none d-lg-inline">Thêm mới</span>
            </button>
          )}

          {filters && filters.length > 0 && (
            <button className="table-action-icon-btn table-action-filter-toggle d-md-none" onClick={() => setIsExpanded(!isExpanded)}>
              <Filter size={18} />
            </button>
          )}
        </div>

        {isExpanded && (
          <button className="table-action-icon-btn d-md-none border-0" onClick={() => setIsExpanded(false)}>
            <X size={18} />
          </button>
        )}
      </div>

      {filters && filters.length > 0 && (
        <div className={`row g-3 pt-3 animate-fade-in ${isExpanded ? 'd-flex' : 'd-none d-md-flex'}`}>
          <div className="col-12">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Filter className="table-action-filter-title-icon" size={14} />
              <span className="table-action-filter-title fw-bold text-uppercase">Bộ lọc chi tiết</span>
            </div>
          </div>
          {filters.map((f, idx) => (
            <div key={idx} className="col-12 col-sm-6 col-md-3 col-lg-2">
              <div className="filter-group">
                <label className="table-action-filter-label mb-1 d-block ps-1 fw-medium">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="table-action-filter-input form-select form-select-sm shadow-none"
                    onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {f.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="table-action-filter-input form-control form-control-sm shadow-none custom-placeholder"
                    placeholder={f.placeholder || 'Nhập...'}
                    onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableActionBar;
