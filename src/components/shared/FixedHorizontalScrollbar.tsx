import { useEffect, useRef, useState } from 'react';

type Props = {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  className?: string;
};

/**
 * Fixed horizontal scrollbar that stays at the bottom of the viewport
 * and syncs with a scrollable container's horizontal scroll
 */
export function FixedHorizontalScrollbar({
  scrollContainerRef,
  className = '',
}: Props) {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(20);

  // Check if container has horizontal overflow and update thumb size
  useEffect(() => {
    const checkOverflow = () => {
      const container = scrollContainerRef.current;
      if (!container) {
        setHasHorizontalScroll(false);
        return;
      }

      const hasOverflow = container.scrollWidth > container.clientWidth;
      setHasHorizontalScroll(hasOverflow);

      if (hasOverflow) {
        const scrollbar = scrollbarRef.current;
        if (scrollbar) {
          const containerScrollWidth = container.scrollWidth;
          const containerClientWidth = container.clientWidth;
          const scrollbarClientWidth = scrollbar.clientWidth;
          const calculatedThumbWidth = Math.max(
            20,
            (containerClientWidth / containerScrollWidth) * scrollbarClientWidth
          );
          setThumbWidth(calculatedThumbWidth);
        }
      }
    };

    checkOverflow();

    // Use ResizeObserver to detect size changes
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    // Also check on window resize
    window.addEventListener('resize', checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [scrollContainerRef]);

  // Sync scrollbar position with container scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    const scrollbar = scrollbarRef.current;
    if (!container || !scrollbar || !hasHorizontalScroll) return;

    const updateScrollbar = () => {
      if (isDragging) return;

      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const maxScroll = scrollWidth - clientWidth;

      if (maxScroll <= 0) {
        setThumbPosition(0);
        return;
      }

      const scrollRatio = scrollLeft / maxScroll;
      const scrollbarWidth = scrollbar.clientWidth;
      const maxThumbPosition = scrollbarWidth - thumbWidth;
      const newPosition = scrollRatio * maxThumbPosition;
      setThumbPosition(Math.max(0, Math.min(maxThumbPosition, newPosition)));
    };

    const handleScroll = () => {
      updateScrollbar();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollbar();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, hasHorizontalScroll, isDragging, thumbWidth]);

  // Handle scrollbar drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const container = scrollContainerRef.current;
    const scrollbar = scrollbarRef.current;
    if (!container || !scrollbar) return;

    const scrollbarRect = scrollbar.getBoundingClientRect();
    const scrollbarWidth = scrollbarRect.width;
    const containerScrollWidth = container.scrollWidth;
    const containerClientWidth = container.clientWidth;
    const maxScroll = containerScrollWidth - containerClientWidth;
    const maxThumbPosition = scrollbarWidth - thumbWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX - scrollbarRect.left;
      const newThumbPosition = Math.max(
        0,
        Math.min(maxThumbPosition, x - thumbWidth / 2)
      );
      setThumbPosition(newThumbPosition);

      const scrollRatio = newThumbPosition / maxThumbPosition;
      const scrollLeft = scrollRatio * maxScroll;
      container.scrollLeft = scrollLeft;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!hasHorizontalScroll) return null;

  return (
    <div
      ref={scrollbarRef}
      className={`fixed bottom-0 left-0 right-0 h-4 bg-slate-900/90 border-t border-slate-700 z-50 backdrop-blur-sm ${className}`}
      style={{ width: '100%' }}
    >
      <div className="relative h-full w-full px-2">
        <div
          className="fixed-scrollbar-thumb absolute top-1 h-2 bg-slate-600 hover:bg-slate-500 rounded cursor-grab active:cursor-grabbing transition-colors"
          style={{
            width: `${thumbWidth}px`,
            minWidth: '20px',
            transform: `translateX(${thumbPosition}px)`,
          }}
          onMouseDown={handleMouseDown}
        />
      </div>
    </div>
  );
}
