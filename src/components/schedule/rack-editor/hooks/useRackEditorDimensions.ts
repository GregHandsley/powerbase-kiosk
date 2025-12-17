import { useEffect, useRef, useState } from "react";

const BASE_HEIGHT = 900;

export function useRackEditorDimensions() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(800);
  const [availableHeight, setAvailableHeight] = useState(600);

  // Calculate available space
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Available width (full container width minus padding)
      const width = rect.width - 16;
      // Available height (viewport minus space for header and footer content)
      const height = Math.max(400, window.innerHeight - rect.top - 180);

      setAvailableWidth(width);
      setAvailableHeight(height);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      ro.disconnect();
    };
  }, []);

  // Calculate base width to match available aspect ratio
  const screenAspectRatio = availableWidth / availableHeight;
  const BASE_WIDTH = BASE_HEIGHT * screenAspectRatio;

  // Zoom to fit - will be close to 1.0 since we matched the ratio
  const zoomLevel = Math.min(availableWidth / BASE_WIDTH, availableHeight / BASE_HEIGHT);

  // Actual rendered dimensions
  const renderedHeight = BASE_HEIGHT * zoomLevel;
  const renderedWidth = BASE_WIDTH * zoomLevel;

  return {
    containerRef,
    BASE_WIDTH,
    BASE_HEIGHT,
    zoomLevel,
    renderedHeight,
    renderedWidth,
  };
}

