import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, UserPlus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import type { BusOption, PassengerRow } from './types';

interface ExtraPassengerPanelProps {
  show: boolean;
  passengers: any[];
  buses: BusOption[];
  selectedBusIds: number[];
  existingPassengerIds: number[];
  extraPassengers: PassengerRow[];
  onAdd: (passenger: PassengerRow) => void;
  onRemove: (passengerId: number) => void;
  onConfirmAll: () => Promise<void>;
  onClose: () => void;
}

const removeVietnameseTones = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

const ExtraPassengerPanel: React.FC<ExtraPassengerPanelProps> = ({
  show,
  passengers,
  buses,
  selectedBusIds,
  existingPassengerIds,
  extraPassengers,
  onAdd,
  onRemove,
  onConfirmAll,
  onClose
}) => {
  const { isDarkMode, colors } = useTheme();
  const [extraSearchTerm, setExtraSearchTerm] = useState('');
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (show && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose(); 
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show, onClose]);

  const handleConfirmAll = async () => {
    setConfirming(true);
    await onConfirmAll();
    setConfirming(false);
  };

  const extraPassengerCandidates = useMemo(() => {
    if (!passengers.length) return [];
    const rawSearch = extraSearchTerm.trim().toLowerCase();
    if (!rawSearch) return [];

    const searchNoTones = removeVietnameseTones(rawSearch);

    return passengers
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name || '',
        tel: p.tel || '',
        assignedBusId: p.bus?.id ? Number(p.bus.id) : null,
        assignedBusName: p.bus?.busCode || p.bus?.registrationNumber || '',
        assignedBusCode: p.bus?.busCode || '',
        assignedBusPlate: p.bus?.registrationNumber || '',
      }))
      .filter((p) => {
        const nameLower = p.name.toLowerCase();
        const nameNoTones = removeVietnameseTones(nameLower);
        return (
          nameLower.includes(rawSearch) ||
          nameNoTones.includes(searchNoTones) ||
          p.tel.includes(rawSearch)
        );
      })
      .sort((a, b) => {
        const aIsExtra = !selectedBusIds.includes(Number(a.assignedBusId));
        const bIsExtra = !selectedBusIds.includes(Number(b.assignedBusId));
        if (aIsExtra && !bIsExtra) return -1;
        if (!aIsExtra && bIsExtra) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [extraSearchTerm, passengers, selectedBusIds]);

  const handleAdd = (candidate: any) => {
    const targetBusId = selectedBusIds && selectedBusIds.length ? Number(selectedBusIds[0]) : null;
    if (!targetBusId) return;
    const actualBus = buses.find((bus) => Number(bus.id) === targetBusId);
    const actualBusName = actualBus?.busCode || actualBus?.registrationNumber || '';

    onAdd({
      id: candidate.id,
      name: candidate.name,
      tel: candidate.tel,
      busId: targetBusId,
      busName: actualBusName,
      assignedBusName: candidate.assignedBusName,
    });
  };

  if (!show) return null;

  return (
    <div 
      ref={panelRef}
      className="extra-passenger-panel p-3 animate-fade-in"
      style={{
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
        borderRadius: '16px',
        border: `1px solid ${colors.border}`,
        boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.03)'
      }}>

      <div className="position-relative mb-3">
        <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 " size={16} />
        <input
          className="form-control custom-search-input"
          placeholder="Tìm tên hoặc SĐT khách trong toàn chuyến..."
          value={extraSearchTerm}
          onChange={(e) => setExtraSearchTerm(e.target.value)}
          style={{
            paddingLeft: '40px',
            height: '42px',
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            fontSize: '14px',
            color: colors.textPrimary
          }}
        />
      </div>

      <div className="search-results-scroll pe-1" style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {extraPassengerCandidates.length === 0 ? (
          extraSearchTerm && (
            <div className="text-center py-4 small">
              <AlertCircle size={18} className="mb-2 opacity-50" /><br />
              Không tìm thấy hành khách nào khớp.
            </div>
          )
        ) : (
          <div className="d-flex flex-column gap-1">
            {extraPassengerCandidates.map((p) => {
              const isAlreadyAdded = extraPassengers.some(ep => ep.id === p.id);
              const isAlreadyInMainTable = existingPassengerIds.includes(p.id);
              const isGuest = !selectedBusIds.includes(Number(p.assignedBusId));
              const showAddButton = !isAlreadyInMainTable;

              return (
                <div key={p.id}
                  className={`candidate-row d-flex align-items-center justify-content-between p-2 rounded-3 transition-all ${isGuest ? 'is-guest-highlight' : ''}`}
                  style={{ borderBottom: `1px solid ${colors.border}22` }}>
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar-placeholder" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', color: colors.textSecondary }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="d-flex flex-column">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold" style={{ fontSize: '13.5px', color: colors.textPrimary }}>{p.name}</span>
                        {isAlreadyInMainTable && (
                          <span className="badge-status-in-table">
                            <CheckCircle size={10} className="me-1" /> Trong xe
                          </span>
                        )}
                        {isGuest && !isAlreadyInMainTable && (
                           <span className="badge bg-info-subtle text-info border border-info-subtle" style={{fontSize: '9px', padding: '1px 6px', borderRadius: '4px'}}>
                            Ngoài xe
                          </span>
                        )}
                      </div>
                      <span className="extra-small ">
                        {p.tel || 'Chưa có SĐT'} • Biên chế: <span className="fw-medium text-primary">{p.assignedBusCode || 'N/A'}</span>
                      </span>
                    </div>
                  </div>

                  {showAddButton ? (
                    <button
                      className={`btn-add-action ${isAlreadyAdded ? 'added' : ''}`}
                      disabled={!(selectedBusIds && selectedBusIds.length) || isAlreadyAdded}
                      onClick={() => handleAdd(p)}
                    >
                      {isAlreadyAdded ? (
                        <><CheckCircle size={14} className="me-1" /> Chờ thêm</>
                      ) : (
                        <><UserPlus size={14} className="me-1" /> Thêm khách</>
                      )}
                    </button>
                  ) : (
                    <div className=" small px-2 py-1" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                      Đã có trong danh sách
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {extraPassengers.length > 0 && (
        <div className="mt-3 pt-3 border-top animate-fade-up" style={{ borderColor: colors.border }}>
          <div className="d-flex align-items-center justify-content-between mb-2 px-1">
            <span className="small fw-bold text-uppercase " style={{ letterSpacing: '0.05em', fontSize: '11px' }}>
              Khách chờ thêm ({extraPassengers.length})
            </span>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            {extraPassengers.map((p) => (
              <div key={p.id} className="selected-tag d-flex align-items-center gap-2 pl-2 pr-1 py-1 rounded-pill"
                style={{ backgroundColor: `${colors.primary}12`, border: `1px solid ${colors.primary}33`, color: colors.primary }}>
                <span className="fw-bold" style={{ fontSize: '12px' }}>{p.name}</span>
                <button className="btn-remove-tag" onClick={() => onRemove(p.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary w-100 py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
            disabled={confirming || extraPassengers.length === 0}
            style={{ borderRadius: '12px', fontWeight: 'bold', fontSize: '14px' }}
            onClick={handleConfirmAll}
          >
            {confirming ? (
              <><span className="spinner-border spinner-border-sm" /> Đang xử lý...</>
            ) : (
              <><UserPlus size={18} /> Xác nhận thêm vào bảng</>
            )}
          </button>
        </div>
      )}

      <style>{`
        .custom-search-input::placeholder {
            color: ${isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8'} !important;
            opacity: 1; /* Cần thiết cho Firefox */
            font-style: italic; /* Thêm nghiêng nếu muốn */
       }
        .extra-small { font-size: 11px; }
        
        .avatar-placeholder {
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 12px;
        }

        .badge-status-in-table {
          font-size: 9px;
          padding: 1px 6px;
          border-radius: 4px;
          background: ${colors.success}15;
          color: ${colors.success};
          border: 1px solid ${colors.success}33;
          display: flex; align-items: center;
        }

        .btn-add-action {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid ${colors.primary};
          background: transparent;
          color: ${colors.primary};
          display: flex; align-items: center;
          transition: all 0.2s;
        }

        .btn-add-action:hover:not(:disabled) {
          background: ${colors.primary};
          color: #fff;
          transform: translateY(-1px);
        }

        .btn-add-action.added {
          background: ${colors.success}22;
          border-color: ${colors.success}44;
          color: ${colors.success};
        }

        .is-guest-highlight {
          background-color: ${isDarkMode ? 'rgba(0, 163, 255, 0.05)' : 'rgba(240, 249, 255, 1)'};
          border-left: 3px solid #0ea5e9 !important;
        }

        .candidate-row {
          border-left: 3px solid transparent;
        }

        .btn-remove-tag {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: none;
          background: ${colors.primary}22;
          color: ${colors.primary};
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }

        .btn-remove-tag:hover {
          background: ${colors.primary};
          color: #fff;
        }

        .candidate-row:hover {
          background-color: ${isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
        }

        .search-results-scroll::-webkit-scrollbar { width: 4px; }
        .search-results-scroll::-webkit-scrollbar-thumb { 
          background: ${colors.border}; 
          border-radius: 10px; 
        }
      `}</style>
    </div>
  );
};

export default ExtraPassengerPanel;