import { useEffect, type ReactNode } from 'react';
import { IconX } from './Icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  headerActions,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cardSizeClass = size === 'xl' ? 'app-modal-card modal-xl' : size === 'lg' ? 'app-modal-card modal-lg' : 'app-modal-card';

  return (
    <div
      className="app-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={cardSizeClass} onClick={(e) => e.stopPropagation()}>
        <div className="app-modal-header">
          <div>
            <h3 className="app-modal-title">{title}</h3>
            {subtitle ? <div className="app-modal-subtitle">{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {headerActions}
            <button
              type="button"
              className="app-modal-close"
              onClick={onClose}
              aria-label="Tutup"
              title="Tutup (Esc)"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>

        <div className="app-modal-body">
          {children}
        </div>

        {footer ? (
          <div className="app-modal-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

