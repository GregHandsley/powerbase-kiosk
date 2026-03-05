import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ModalPortal } from './ModalPortal';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Optional class for the overlay (e.g. z-[1100] for stacking above another modal) */
  overlayClassName?: string;
  lockScroll?: boolean;
  maxWidth?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl'
    | 'full';
};

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

/**
 * Reusable modal component with backdrop and click-outside-to-close
 */
export function Modal({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  lockScroll = false,
  maxWidth = 'md',
}: ModalProps) {
  const [viewportTop, setViewportTop] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setViewportTop(window.scrollY || window.pageYOffset || 0);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        className={clsx(
          'absolute inset-x-0 z-[1000] flex min-h-screen items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center',
          overlayClassName
        )}
        style={{ top: `${viewportTop}px` }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={clsx(
            'my-6 w-full max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-6 sm:my-0 min-h-0 overflow-y-auto',
            maxWidthClasses[maxWidth],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
