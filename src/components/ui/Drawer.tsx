import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  onBack,
  children,
  footer,
  className = '',
}) => {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Focus trap / restoration
  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus panel or interactive element inside
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
  }, [open]);

  // Restore focus if component unmounts while open
  useEffect(() => {
    return () => {
      previousActiveElementRef.current?.focus();
    };
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-[3px] animate-drawer-backdrop cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed bottom-0 inset-x-0 w-full max-h-[92dvh] rounded-t-[28px] border-t border-border-subtle bg-carnet-ground text-text-primary flex flex-col focus:outline-none animate-drawer-panel sm:fixed sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:w-[480px] sm:h-full sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-l sm:border-border-subtle sm:shadow-[-24px_0_60px_rgba(0,0,0,0.45)] ${className}`}
      >
        {/* Mobile handle indicator */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-border-default" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <Button
                variant="ghost"
                iconOnly
                icon={ArrowLeft}
                aria-label="Volver"
                onClick={onBack}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[13px] text-text-muted truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            iconOnly
            icon={X}
            aria-label="Cerrar"
            onClick={onClose}
          />
        </div>

        {/* Content with independent scrolling */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 sm:p-5 border-t border-border-subtle bg-carnet-ground shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

