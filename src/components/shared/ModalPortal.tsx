import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
  children: ReactNode;
  lockScroll?: boolean;
};

let nextScrollLockId = 1;
const activeScrollLocks = new Set<number>();
let originalBodyOverflow: string | null = null;

/**
 * Render modal overlays at the document root so they stay viewport-centered.
 */
export function ModalPortal({
  children,
  lockScroll = false,
}: ModalPortalProps) {
  const lockIdRef = useRef<number>(nextScrollLockId++);

  useEffect(() => {
    if (!lockScroll) return;

    const { body } = document;
    const lockId = lockIdRef.current;
    if (activeScrollLocks.size === 0) {
      originalBodyOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    activeScrollLocks.add(lockId);

    return () => {
      activeScrollLocks.delete(lockId);
      if (activeScrollLocks.size === 0) {
        body.style.overflow = originalBodyOverflow ?? '';
        originalBodyOverflow = null;
      }
    };
  }, [lockScroll]);

  return createPortal(
    <div className="contents">{children}</div>,
    document.body
  );
}
