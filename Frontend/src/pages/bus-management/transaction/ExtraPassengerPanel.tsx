import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, UserPlus, X, AlertCircle, CheckCircle } from 'lucide-react';
import type { BusOption, PassengerRow } from './types';
import './ExtraPassengerPanel.css';

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
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
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
  confirmDisabled = false,
  confirmDisabledReason,
  onClose
}) => {
  const [extraSearchTerm, setExtraSearchTerm] = useState('');
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const targetBusId = selectedBusIds && selectedBusIds.length ? Number(selectedBusIds[0]) : null;

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
    if (confirmDisabled) return;
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
        note: p.note || '',
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
        const targetBusId = selectedBusIds && selectedBusIds.length ? Number(selectedBusIds[0]) : null;
        const aIsExtra = targetBusId !== null && Number(a.assignedBusId) !== targetBusId;
        const bIsExtra = targetBusId !== null && Number(b.assignedBusId) !== targetBusId;
        if (aIsExtra && !bIsExtra) return -1;
        if (!aIsExtra && bIsExtra) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [extraSearchTerm, passengers, selectedBusIds]);

  const handleAdd = (candidate: any) => {
    if (!targetBusId) return;
    const actualBus = buses.find((bus) => Number(bus.id) === targetBusId);
    const actualBusName = actualBus?.busCode || actualBus?.registrationNumber || '';

    onAdd({
      id: candidate.id,
      name: candidate.name,
      tel: candidate.tel,
      note: candidate.note || '',
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
    >

      <div className="position-relative mb-3">
        <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 " size={16} />
        <input
          className="form-control custom-search-input"
          placeholder="Tìm tên hoặc SĐT khách trong toàn chuyến..."
          value={extraSearchTerm}
          onChange={(e) => setExtraSearchTerm(e.target.value)}
        />
      </div>

      <div className="search-results-scroll pe-1">
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
              const isAssignedToTargetBus = targetBusId !== null && Number(p.assignedBusId) === targetBusId;
              const isAlreadyInCurrentBusTable = isAssignedToTargetBus && existingPassengerIds.includes(p.id);
              const isGuest = !isAssignedToTargetBus;
              const showAddButton = isGuest;

              return (
                <div key={p.id}
                  className={`candidate-row d-flex align-items-center justify-content-between p-2 rounded-3 transition-all ${isGuest ? 'is-guest-highlight' : ''}`}>
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar-placeholder">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="d-flex flex-column">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold candidate-name">{p.name}</span>
                        {isAlreadyInCurrentBusTable && (
                          <span className="badge-status-in-table">
                            <CheckCircle size={10} className="me-1" /> Trong xe
                          </span>
                        )}
                        {isGuest && (
                           <span className="badge bg-info-subtle text-info border border-info-subtle extra-passenger-badge">
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
                    <div className="small px-2 py-1 already-listed-text">
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
        <div className="mt-3 pt-3 border-top animate-fade-up extra-passenger-selected-section">
          <div className="d-flex align-items-center justify-content-between mb-2 px-1">
            <span className="small fw-bold text-uppercase extra-passenger-selected-title">
              Khách chờ thêm ({extraPassengers.length})
            </span>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            {extraPassengers.map((p) => (
              <div key={p.id} className="selected-tag d-flex align-items-center gap-2 pl-2 pr-1 py-1 rounded-pill"
              >
                <span className="fw-bold selected-tag-name">{p.name}</span>
                <button className="btn-remove-tag" onClick={() => onRemove(p.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary w-100 py-2 shadow-sm d-flex align-items-center justify-content-center gap-2 extra-passenger-confirm-button"
            disabled={confirming || extraPassengers.length === 0 || confirmDisabled}
            onClick={handleConfirmAll}
          >
            {confirming ? (
              <><span className="spinner-border spinner-border-sm" /> Đang xử lý...</>
            ) : (
              <><UserPlus size={18} /> Xác nhận thêm vào bảng</>
            )}
          </button>

          {confirmDisabled && confirmDisabledReason ? (
            <div className="small text-warning mt-2 text-center extra-passenger-warning">
              {confirmDisabledReason}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ExtraPassengerPanel;
