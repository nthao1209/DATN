import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import './adminReusable.css';

type SaveChangesActionProps = {
  dirtyCount: number;
  isSaving: boolean;
  canSave: boolean;
  onSave: () => void;
  validationMessage?: string;
  messageMaxWidth?: string;
  leadingAction?: ReactNode;
};

const SaveChangesAction = ({
  dirtyCount,
  isSaving,
  canSave,
  onSave,
  validationMessage,
  messageMaxWidth = '320px',
  leadingAction,
}: SaveChangesActionProps) => {
  if (dirtyCount <= 0) return null;
  const messageClassName = `small text-end admin-save-message${messageMaxWidth === '280px' ? ' is-narrow' : ''}`;

  return (
    <div className="admin-save-action">
      {leadingAction}
      <button
        className={`btn-custom-action-save shadow-sm save-floating-action ${canSave ? 'is-enabled' : ''}`}
        onClick={onSave}
        disabled={isSaving || !canSave}
        title={validationMessage || undefined}
      >
        <Save size={16} />
        <span className="d-none d-sm-inline">{isSaving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}</span>
        <span className="d-inline d-sm-none">{dirtyCount}</span>
      </button>
      {validationMessage && (
        <div className={messageClassName}>
          {validationMessage}
        </div>
      )}
    </div>
  );
};

export default SaveChangesAction;
