/**
 * Simplified edit modal for My Bookings: mini floorplan (platforms + areas) click to change,
 * plus number of athletes. Replaces the need to open the full BookingEditorModal and then
 * "Edit Racks" for a quicker flow.
 */

import { useState, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '../shared/Modal';
import { MiniScheduleFloorplan } from '../shared/MiniScheduleFloorplan';
import { MiniAreasFloorplan } from '../shared/MiniAreasFloorplan';
import { supabase } from '../../lib/supabaseClient';
import { saveAreaSlotsForInstance } from '../../nodes/data/areaSlotsNodes';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { BookingWithInstances } from '../../hooks/useMyBookings';

type Props = {
  booking: BookingWithInstances;
  selectedInstanceIds: number[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function EditBookingSimpleModal({
  booking,
  selectedInstanceIds,
  isOpen,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const referenceInstance = useMemo(
    () =>
      booking.instances.find((i) => selectedInstanceIds.includes(i.id)) ??
      booking.instances[0],
    [booking.instances, selectedInstanceIds]
  );

  const [selectedRacks, setSelectedRacks] = useState<number[]>(() =>
    referenceInstance ? [...referenceInstance.racks].sort((a, b) => a - b) : []
  );
  const [selectedAreaKeys, setSelectedAreaKeys] = useState<string[]>(() =>
    referenceInstance ? [...referenceInstance.areas] : []
  );
  const [capacity, setCapacity] = useState(referenceInstance?.capacity ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sideKey = useMemo(
    () =>
      (booking.side?.key === 'Base' || booking.side?.key === 'base'
        ? 'Base'
        : 'Power') as 'Power' | 'Base',
    [booking.side]
  );

  const startTime = referenceInstance?.start ?? '';
  const endTime = referenceInstance?.end ?? '';
  const excludeInstanceIds = useMemo(
    () => new Set(selectedInstanceIds),
    [selectedInstanceIds]
  );

  const handleRackClick = useCallback(
    (rackNumber: number, replace?: boolean) => {
      setSelectedRacks((prev) => {
        if (replace) return [rackNumber];
        const next = prev.includes(rackNumber)
          ? prev.filter((n) => n !== rackNumber)
          : [...prev, rackNumber].sort((a, b) => a - b);
        return next;
      });
    },
    []
  );

  const handleAreaClick = useCallback((areaKey: string) => {
    setSelectedAreaKeys((prev) =>
      prev.includes(areaKey)
        ? prev.filter((k) => k !== areaKey)
        : [...prev, areaKey]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!referenceInstance || selectedInstanceIds.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const instancesToUpdate = booking.instances.filter((i) =>
        selectedInstanceIds.includes(i.id)
      );

      for (const inst of instancesToUpdate) {
        const { error: updateErr } = await supabase
          .from('booking_instances')
          .update({
            racks: selectedRacks,
            capacity,
            areas: selectedAreaKeys,
          })
          .eq('id', inst.id);

        if (updateErr) throw new Error(updateErr.message);

        const slots: Array<{ area_key: string; start: string; end: string }> = [
          ...selectedRacks.map((r) => ({
            area_key: `rack_${r}`,
            start: inst.start,
            end: inst.end,
          })),
          ...selectedAreaKeys.map((area_key) => ({
            area_key,
            start: inst.start,
            end: inst.end,
          })),
        ];
        const { error: slotsErr } = await saveAreaSlotsForInstance(
          inst.id,
          slots
        );
        if (slotsErr) throw slotsErr;
      }

      if (booking.id && user?.id) {
        const updateData: {
          last_edited_at: string;
          last_edited_by: string;
          status?: string;
        } = {
          last_edited_at: new Date().toISOString(),
          last_edited_by: user.id,
        };
        // When a processed booking is edited, set status to pending so it appears in Bookings Team for processing
        if (booking.status === 'processed') {
          updateData.status = 'pending';
        }
        await supabase.from('bookings').update(updateData).eq('id', booking.id);
      }

      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['snapshot'] });
      await queryClient.invalidateQueries({ queryKey: ['booking-series'] });
      await queryClient.invalidateQueries({ queryKey: ['bookings-team'] });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [
    referenceInstance,
    selectedInstanceIds,
    booking.instances,
    booking.id,
    booking.status,
    selectedRacks,
    selectedAreaKeys,
    capacity,
    user?.id,
    queryClient,
    onSaved,
    onClose,
  ]);

  const editingLabel =
    selectedInstanceIds.length === 1
      ? format(
          parseISO(
            booking.instances.find((i) => i.id === selectedInstanceIds[0])!
              .start
          ),
          'EEE d MMM yyyy'
        )
      : `All ${selectedInstanceIds.length} sessions`;

  if (!isOpen || !referenceInstance) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="7xl"
      lockScroll
      className="min-h-[85vh] max-h-[95vh] flex flex-col"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {booking.title}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Editing: {editingLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Number of athletes
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 100) setCapacity(v);
            }}
            disabled={saving}
            className="w-full max-w-[120px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        <p className="text-sm text-slate-400">
          Click platforms and areas on the map to change where this session is
          held.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[55vh]">
          <div className="border border-slate-700 rounded-lg bg-slate-900/60 p-3 min-h-[48vh] flex flex-col">
            <MiniScheduleFloorplan
              sideKey={sideKey}
              selectedRacks={selectedRacks}
              onRackClick={handleRackClick}
              startTime={startTime}
              endTime={endTime}
              showTitle={true}
              allowConflictingRacks={true}
              excludeInstanceIds={excludeInstanceIds}
            />
          </div>
          <div className="border border-slate-700 rounded-lg bg-slate-900/60 p-3 min-h-[48vh] flex flex-col">
            <label className="block mb-1 font-medium text-xs text-slate-400">
              Areas
            </label>
            <div className="flex-1 min-h-[280px]">
              <MiniAreasFloorplan
                sideKey={sideKey}
                selectedAreaKeys={selectedAreaKeys}
                onAreaClick={handleAreaClick}
                areasInteractive={true}
                onPlatformsClick={() => {}}
                platformLabel="Platforms (use map left)"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-900/20 border border-red-700/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              (selectedRacks.length === 0 && selectedAreaKeys.length === 0)
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
