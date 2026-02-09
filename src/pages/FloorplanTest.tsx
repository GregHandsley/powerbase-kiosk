import { useState } from 'react';
import { BaseFloorplan } from '../components/floorplans/base/BaseFloorplan';
import { useSideSnapshot } from '../hooks/useSideSnapshot';
import type { SideKey } from '../nodes/data/sidesNodes';

/**
 * Test page for experimenting with floorplan orientation
 * This is isolated from the main kiosk to avoid breaking existing work
 */
export function FloorplanTest() {
  const [sideKey, setSideKey] = useState<SideKey>('Base');
  const [viewBoxWidth, setViewBoxWidth] = useState(160);
  const [viewBoxHeight, setViewBoxHeight] = useState(90);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  const { snapshot } = useSideSnapshot(sideKey);

  return (
    <div className="h-screen w-screen bg-slate-900 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">
          Floorplan Orientation Test
        </h1>

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Side</label>
              <select
                value={sideKey}
                onChange={(e) => setSideKey(e.target.value as SideKey)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              >
                <option value="Base">Base</option>
                <option value="Power">Power</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                ViewBox Width
              </label>
              <input
                type="number"
                value={viewBoxWidth}
                onChange={(e) => setViewBoxWidth(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                ViewBox Height
              </label>
              <input
                type="number"
                value={viewBoxHeight}
                onChange={(e) => setViewBoxHeight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Rotation (degrees)
              </label>
              <input
                type="number"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Scale</label>
              <input
                type="number"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                // Swap width/height for 90deg rotation
                const temp = viewBoxWidth;
                setViewBoxWidth(viewBoxHeight);
                setViewBoxHeight(temp);
                setRotation(
                  rotation === 0
                    ? 90
                    : rotation === 90
                      ? 180
                      : rotation === 180
                        ? 270
                        : 0
                );
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Rotate 90°
            </button>
            <button
              onClick={() => {
                setViewBoxWidth(160);
                setViewBoxHeight(90);
                setRotation(0);
                setScale(1);
              }}
              className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Floorplan Display */}
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-center min-h-[500px]">
            <div
              style={{
                transform: `rotate(${rotation}deg) scale(${scale})`,
                transformOrigin: 'center',
                width: '600px',
                height: `${(600 * viewBoxHeight) / viewBoxWidth}px`,
              }}
              className="border border-slate-600"
            >
              {snapshot && (
                <BaseFloorplan
                  snapshot={snapshot}
                  appearance="status-board"
                  highlightedRacks={new Set()}
                />
              )}
            </div>
          </div>
        </div>

        {/* Current Settings Display */}
        <div className="mt-4 text-sm text-slate-400">
          <p>
            ViewBox: {viewBoxWidth} × {viewBoxHeight}
          </p>
          <p>Rotation: {rotation}°</p>
          <p>Scale: {scale}x</p>
        </div>
      </div>
    </div>
  );
}
