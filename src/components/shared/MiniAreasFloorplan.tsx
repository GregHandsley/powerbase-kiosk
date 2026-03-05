/**
 * Mini floorplan for "other" facility areas (zones), matching wayfinding map dimensions (160×90).
 * Refactored into smaller components under mini-areas-floorplan/.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  VIEWBOX_WIDTH,
  VIEWBOX_HEIGHT,
  FLOOR_FILL,
  AREA_FILL,
  AREA_STROKE,
  AREA_STROKE_WIDTH,
  PLATFORM_OVERLAY_FILL,
  PLATFORM_OVERLAY_STROKE,
  PLATFORM_OVERLAY_STROKE_WIDTH,
} from './mini-areas-floorplan/constants';
import { insetRect } from './mini-areas-floorplan/utils';
import type { MiniAreasFloorplanProps } from './mini-areas-floorplan/types';
import { BaseAreas } from './mini-areas-floorplan/BaseAreas';
import { PowerAreas } from './mini-areas-floorplan/PowerAreas';
import { AreaDnDOverlay } from './mini-areas-floorplan/AreaDnDOverlay';

export type { MiniAreasFloorplanProps as Props } from './mini-areas-floorplan/types';

export function MiniAreasFloorplan({
  sideKey,
  selectedAreaKeys,
  onAreaClick,
  areaBookingByKey,
  enableAreaDrag = false,
  onEditBooking,
  areaKeysFilter,
  bookedAreaKeys,
  freeIntervalsByArea,
  areasInteractive = true,
  onPlatformsClick,
  platformLabel = 'Platforms',
  platformOverlayFill,
  platformOverlayStroke,
  fit = 'contain',
  showOuterFrame = true,
}: MiniAreasFloorplanProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const selectedSet = useMemo(
    () => new Set(selectedAreaKeys),
    [selectedAreaKeys]
  );

  const platformOverlay =
    sideKey === 'Base'
      ? { x: 40, y: 3, width: 30, height: 84 }
      : { x: 75, y: 32, width: 45, height: 25 };

  const handleAreaClick = (areaKey: string) => {
    if (areaKeysFilter?.length && !areaKeysFilter.includes(areaKey)) return;
    onAreaClick(areaKey);
  };

  const isAreaVisible = (key: string) =>
    !areaKeysFilter?.length || areaKeysFilter.includes(key);
  const platformIsHotspot = Boolean(onPlatformsClick) && !areasInteractive;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      setContainerSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const renderBox = useMemo(() => {
    const { width, height } = containerSize;
    if (width <= 0 || height <= 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    if (fit === 'fill') {
      return { x: 0, y: 0, width, height };
    }
    const scale =
      fit === 'cover'
        ? Math.max(width / VIEWBOX_WIDTH, height / VIEWBOX_HEIGHT)
        : Math.min(width / VIEWBOX_WIDTH, height / VIEWBOX_HEIGHT);
    const renderedWidth = VIEWBOX_WIDTH * scale;
    const renderedHeight = VIEWBOX_HEIGHT * scale;
    return {
      x: (width - renderedWidth) / 2,
      y: (height - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight,
    };
  }, [containerSize, fit]);

  const r = insetRect(
    platformOverlay.x,
    platformOverlay.y,
    platformOverlay.width,
    platformOverlay.height
  );
  const useAreaStyle = platformIsHotspot;

  return (
    <div ref={containerRef} className="w-full h-full min-h-0 min-w-0 relative">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="w-full h-full block"
        preserveAspectRatio={
          fit === 'fill'
            ? 'none'
            : fit === 'cover'
              ? 'xMidYMid slice'
              : 'xMidYMid meet'
        }
      >
        <rect
          x={0}
          y={0}
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          fill={FLOOR_FILL}
          stroke={showOuterFrame ? AREA_STROKE : 'transparent'}
          strokeWidth={showOuterFrame ? AREA_STROKE_WIDTH : 0}
          rx={4}
        />

        {sideKey === 'Base' ? (
          <BaseAreas
            selectedSet={selectedSet}
            onAreaClick={handleAreaClick}
            isAreaVisible={isAreaVisible}
            areasInteractive={areasInteractive}
            bookedAreaKeys={bookedAreaKeys}
            freeIntervalsByArea={freeIntervalsByArea}
            areaBookingByKey={enableAreaDrag ? undefined : areaBookingByKey}
          />
        ) : (
          <PowerAreas
            selectedSet={selectedSet}
            onAreaClick={handleAreaClick}
            isAreaVisible={isAreaVisible}
            areasInteractive={areasInteractive}
            bookedAreaKeys={bookedAreaKeys}
            freeIntervalsByArea={freeIntervalsByArea}
            areaBookingByKey={enableAreaDrag ? undefined : areaBookingByKey}
          />
        )}

        <g>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={
              useAreaStyle
                ? AREA_FILL
                : (platformOverlayFill ?? PLATFORM_OVERLAY_FILL)
            }
            stroke={
              useAreaStyle
                ? AREA_STROKE
                : (platformOverlayStroke ?? PLATFORM_OVERLAY_STROKE)
            }
            strokeWidth={
              useAreaStyle ? AREA_STROKE_WIDTH : PLATFORM_OVERLAY_STROKE_WIDTH
            }
            rx={4}
            ry={4}
            className={
              onPlatformsClick
                ? platformIsHotspot
                  ? 'session-platform-hotspot'
                  : undefined
                : 'pointer-events-none'
            }
            style={onPlatformsClick ? { cursor: 'pointer' } : undefined}
            onClick={onPlatformsClick}
          />
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={
              useAreaStyle
                ? 'rgba(203, 213, 225, 0.9)'
                : 'rgba(148, 163, 184, 0.5)'
            }
            fontSize={3.2}
            fontWeight={600}
            className={onPlatformsClick ? 'pointer-events-none' : undefined}
          >
            {platformLabel}
          </text>
        </g>
      </svg>
      {enableAreaDrag && areaBookingByKey && (
        <AreaDnDOverlay
          sideKey={sideKey}
          areaBookingByKey={areaBookingByKey}
          areaKeysFilter={areaKeysFilter}
          renderBox={renderBox}
          onEditBooking={onEditBooking}
        />
      )}
    </div>
  );
}
