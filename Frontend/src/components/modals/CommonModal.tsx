import React from 'react'

interface CommonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void;
  children: React.ReactNode;
  submitLabel?: string;
  isLoading?: boolean;
}

const CommonModal: React.FC<CommonModalProps> = ({ 
  isOpen, onClose, title, onSubmit, children, submitLabel = 'Lưu', isLoading = false 
 }) => {
  if(!isOpen) return null;

  return (
    <>
      <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered border-0">
          <div className="modal-content shadow-lg border-0">
            {/* Header */}
            <div className="modal-header bg-primary text-white py-3">
              <h5 className="modal-title fw-bold">{title}</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>

            {/* Body */}
            <div className="modal-body p-4">
              {children}
            </div>

            {/* Footer */}
            <div className="modal-footer bg-light border-top-0">
              <button type="button" className="btn btn-outline-secondary px-4" onClick={onClose} disabled={isLoading}>
                Hủy
              </button>
              <button 
                type="button" 
                className="btn btn-primary px-4 d-flex align-items-center gap-2" 
                onClick={onSubmit}
                disabled={isLoading}
              >
                {isLoading && <span className="spinner-border spinner-border-sm"></span>}
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Backdrop cho chắc chắn */}
      <div className="modal-backdrop fade show"></div>
    </>
  );
};

export default CommonModal;
