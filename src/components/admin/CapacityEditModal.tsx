import { useState, useEffect } from 'react';
// import { format } from 'date-fns';
// import { getSideIdByKeyNode, type SideKey } from '../../nodes/data/sidesNodes';
import { useCapacityDefaults } from './capacity/useCapacityDefaults';
import { CapacityEditForm } from './capacity/CapacityEditForm';

type RecurrenceType =
  | 'single'
  | 'weekday'
  | 'weekend'
  | 'all_future'
  | 'weekly';
type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    capacity: number;
    periodType: PeriodType;
    recurrenceType: RecurrenceType;
    startTime: string;
    endTime: string;
    platforms: number[];
  }) => Promise<void>;
  onDelete?: () => void;
  initialDate: Date;
  initialTime: string; // HH:mm format
  initialEndTime?: string; // HH:mm format
  sideId: number;
  sideKey: 'Power' | 'Base';
  existingCapacity?: {
    capacity: number;
    periodType: PeriodType;
    platforms?: number[];
  } | null;
  existingRecurrenceType?: RecurrenceType;
};

export function CapacityEditModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialTime,
  initialEndTime,
  sideId,
  sideKey,
  existingCapacity,
  existingRecurrenceType,
}: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>(
    existingCapacity?.periodType || 'General User'
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    existingRecurrenceType || 'single'
  );
  const [startTime, setStartTime] = useState(initialTime);
  const [endTime, setEndTime] = useState(initialEndTime || '23:59');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityOverride, setCapacityOverride] = useState<number | null>(
    existingCapacity?.capacity || null
  );
  const [useOverride, setUseOverride] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>(
    existingCapacity?.platforms || []
  );

  // Fetch default capacity and platforms
  const { defaultCapacity, defaultPlatforms, loadingDefault } =
    useCapacityDefaults(
      isOpen,
      periodType,
      sideId,
      existingCapacity?.platforms
    );

  // Initialize selected platforms from defaults if not set
  // For "Closed" period type, always use empty array (no platforms)
  useEffect(() => {
    if (periodType === 'Closed') {
      setSelectedPlatforms([]);
    } else if (
      isOpen &&
      !existingCapacity?.platforms &&
      defaultPlatforms.length > 0
    ) {
      setSelectedPlatforms(defaultPlatforms);
    }
  }, [isOpen, existingCapacity?.platforms, defaultPlatforms, periodType]);

  // Update capacity override when default capacity or existing capacity changes
  useEffect(() => {
    if (isOpen && existingCapacity && defaultCapacity !== null) {
      const hasOverride = existingCapacity.capacity !== defaultCapacity;
      setUseOverride(hasOverride);
      if (hasOverride) {
        setCapacityOverride(existingCapacity.capacity);
      } else {
        setCapacityOverride(null);
      }
    } else if (isOpen && !existingCapacity) {
      setUseOverride(false);
      setCapacityOverride(null);
    }
  }, [isOpen, existingCapacity, defaultCapacity]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPeriodType(existingCapacity?.periodType || 'General User');
      // When editing existing, force to "single" to only edit that day
      // When creating new, allow any recurrence type
      setRecurrenceType(
        existingCapacity ? 'single' : existingRecurrenceType || 'single'
      );
      setStartTime(initialTime);
      setEndTime(initialEndTime || '23:59');
      // For "Closed" period type, always use empty array (no platforms)
      if (existingCapacity?.periodType === 'Closed') {
        setSelectedPlatforms([]);
      } else {
        setSelectedPlatforms(existingCapacity?.platforms || []);
      }
      setError(null);
    }
  }, [
    isOpen,
    initialTime,
    initialEndTime,
    existingCapacity,
    existingRecurrenceType,
  ]);

  // When period type changes to "Closed", enforce no platforms and capacity 0
  useEffect(() => {
    if (periodType === 'Closed') {
      setSelectedPlatforms([]);
      setCapacityOverride(0);
      setUseOverride(false);
    }
  }, [periodType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    // For "Closed" period type, enforce capacity 0 and no platforms
    const finalCapacity =
      periodType === 'Closed'
        ? 0
        : useOverride && capacityOverride !== null
          ? capacityOverride
          : defaultCapacity;
    const finalPlatforms = periodType === 'Closed' ? [] : selectedPlatforms;

    if (finalCapacity === null) {
      setError(
        'No default capacity set for this period type. Please set a default capacity first.'
      );
      return;
    }

    if (finalCapacity < 0) {
      setError('Capacity cannot be negative');
      return;
    }

    // Validate that closed periods have no platforms
    if (periodType === 'Closed' && finalPlatforms.length > 0) {
      setError('Closed periods cannot have platforms selected.');
      return;
    }

    // Validate that closed periods have capacity 0
    if (periodType === 'Closed' && finalCapacity !== 0) {
      setError('Closed periods must have capacity of 0.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        capacity: finalCapacity,
        periodType,
        recurrenceType,
        startTime,
        endTime,
        platforms: finalPlatforms,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save capacity');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DELETE] Delete button clicked in CapacityEditModal', {
      hasOnDelete: !!onDelete,
    });
    if (!onDelete) {
      console.warn('[DELETE] No onDelete handler provided');
      return;
    }
    // Don't show confirmation here - let the parent component handle it
    // The onDelete callback will trigger the delete confirmation in CapacityManagement
    console.log('[DELETE] Calling onDelete callback');
    onDelete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">
            Edit Capacity
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <CapacityEditForm
          periodType={periodType}
          setPeriodType={setPeriodType}
          recurrenceType={recurrenceType}
          setRecurrenceType={setRecurrenceType}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
          defaultCapacity={defaultCapacity}
          loadingDefault={loadingDefault}
          existingCapacity={existingCapacity}
          capacityOverride={capacityOverride}
          setCapacityOverride={setCapacityOverride}
          useOverride={useOverride}
          setUseOverride={setUseOverride}
          initialDate={initialDate}
          sideKey={sideKey}
        />

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-700">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
