import { useState } from 'react';
import { MiniScheduleFloorplan } from '../../shared/MiniScheduleFloorplan';
// import { getSideIdByKeyNode } from '../../../nodes/data/sidesNodes';

type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

interface PeriodTypeDefault {
  id: number;
  period_type: PeriodType;
  default_capacity: number;
  side_id: number | null;
  platforms: number[] | null;
}

type Props = {
  defaults: Map<string, PeriodTypeDefault>;
  onSave: (
    periodType: PeriodType,
    sideKey: 'Power' | 'Base',
    capacity: number,
    platforms: number[]
  ) => Promise<void>;
  loading: boolean;
  powerSideId: number | null;
  baseSideId: number | null;
};

/**
 * Section for managing period type defaults
 */
export function PeriodTypeDefaultsSection({
  defaults,
  onSave,
  loading,
  powerSideId,
  baseSideId,
}: Props) {
  const [editingDefault, setEditingDefault] = useState<{
    periodType: PeriodType;
    sideKey: 'Power' | 'Base';
  } | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<number>(0);
  const [editingPlatforms, setEditingPlatforms] = useState<number[]>([]);

  const periodTypes: PeriodType[] = [
    'High Hybrid',
    'Low Hybrid',
    'Performance',
    'General User',
    'Closed',
  ];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Default Capacity & Platforms by Period Type
      </h3>
      <div className="space-y-6">
        {periodTypes.map((periodType) => {
          return (
            <div
              key={periodType}
              className="p-4 rounded-md border border-slate-700 bg-slate-950/50"
            >
              <div className="text-sm font-medium text-slate-200 mb-4">
                {periodType}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['Power', 'Base'] as const).map((sideKey) => {
                  const sideId = sideKey === 'Power' ? powerSideId : baseSideId;
                  const key = sideId ? `${periodType}_${sideId}` : null;
                  const default_ = key ? defaults.get(key) : null;
                  const isEditing =
                    editingDefault?.periodType === periodType &&
                    editingDefault?.sideKey === sideKey;

                  return (
                    <div key={sideKey} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-300">
                          {sideKey}
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingDefault({ periodType, sideKey });
                              setEditingCapacity(
                                default_?.default_capacity || 0
                              );
                              setEditingPlatforms(default_?.platforms || []);
                            }}
                            className="px-2 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                          >
                            {default_ ? 'Edit' : 'Set'}
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">
                              Capacity
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={editingCapacity}
                              onChange={(e) =>
                                setEditingCapacity(
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">
                              Platforms
                            </label>
                            {sideId && (
                              <MiniScheduleFloorplan
                                sideKey={sideKey}
                                selectedRacks={editingPlatforms}
                                onRackClick={(rackNumber) => {
                                  const newPlatforms =
                                    editingPlatforms.includes(rackNumber)
                                      ? editingPlatforms.filter(
                                          (r) => r !== rackNumber
                                        )
                                      : [...editingPlatforms, rackNumber].sort(
                                          (a, b) => a - b
                                        );
                                  setEditingPlatforms(newPlatforms);
                                }}
                                startTime={new Date().toISOString()}
                                endTime={new Date(
                                  Date.now() + 3600000
                                ).toISOString()}
                                showTitle={false}
                                allowConflictingRacks={true}
                                ignoreBookings={true}
                              />
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                await onSave(
                                  periodType,
                                  sideKey,
                                  editingCapacity,
                                  editingPlatforms
                                );
                                // Close edit mode after successful save
                                setEditingDefault(null);
                              }}
                              disabled={loading}
                              className="px-3 py-1 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                            >
                              {loading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingDefault(null);
                                // Reset to original values
                                if (default_) {
                                  setEditingCapacity(
                                    default_.default_capacity || 0
                                  );
                                  setEditingPlatforms(default_.platforms || []);
                                }
                              }}
                              disabled={loading}
                              className="px-3 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>
                            Capacity: {default_?.default_capacity ?? 'Not set'}
                          </div>
                          <div>
                            Platforms:{' '}
                            {default_?.platforms &&
                            default_.platforms.length > 0
                              ? default_.platforms.join(', ')
                              : 'Not set'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
