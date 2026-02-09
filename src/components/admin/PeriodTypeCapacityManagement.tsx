import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { getSideIdByKeyNode } from '../../nodes/data/sidesNodes';
import { usePeriodTypeDefaults } from './periodType/usePeriodTypeDefaults';
import { usePeriodTypeOverrides } from './periodType/usePeriodTypeOverrides';
import { useSaveDefault } from './periodType/useSaveDefault';
import { useSaveOverride } from './periodType/useSaveOverride';
import { useDeleteBooking } from './periodType/useDeleteBooking';
import { PeriodTypeDefaultsSection } from './periodType/PeriodTypeDefaultsSection';
import { PeriodTypeOverridesSection } from './periodType/PeriodTypeOverridesSection';
import { OverrideModal } from './periodType/OverrideModal';
import { DeleteOverrideDialog } from './periodType/DeleteOverrideDialog';
import { DeleteBookingDialog } from './periodType/DeleteBookingDialog';
import { supabase } from '../../lib/supabaseClient';

type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

interface PeriodTypeOverride {
  id: number;
  date: string;
  period_type: PeriodType;
  capacity: number;
  booking_id: number | null;
  notes: string | null;
}

export function PeriodTypeCapacityManagement() {
  const [powerSideId, setPowerSideId] = useState<number | null>(null);
  const [baseSideId, setBaseSideId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedOverrides, setExpandedOverrides] = useState<Set<number>>(
    new Set()
  );
  const [selectedInstances, setSelectedInstances] = useState<
    Map<number, Set<number>>
  >(new Map());
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [editingOverride, setEditingOverride] =
    useState<PeriodTypeOverride | null>(null);
  const [overrideDate, setOverrideDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [overridePeriodType, setOverridePeriodType] =
    useState<PeriodType>('High Hybrid');
  const [overrideCapacity, setOverrideCapacity] = useState(0);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [deletingOverrideId, setDeletingOverrideId] = useState<number | null>(
    null
  );
  const [deletingBooking, setDeletingBooking] = useState<{
    bookingId: number;
    instanceIds: number[];
    type: 'selected' | 'series';
  } | null>(null);

  // Fetch side IDs
  useEffect(() => {
    getSideIdByKeyNode('Power').then(setPowerSideId).catch(console.error);
    getSideIdByKeyNode('Base').then(setBaseSideId).catch(console.error);
  }, []);

  // Fetch defaults and overrides
  const {
    defaults,
    loading: defaultsLoading,
    refetch: refetchDefaults,
  } = usePeriodTypeDefaults();
  const {
    overrides,
    loading: overridesLoading,
    refetch: refetchOverrides,
  } = usePeriodTypeOverrides();

  const loading = defaultsLoading || overridesLoading;

  // Save default
  const { saveDefault: handleSaveDefault, loading: savingDefault } =
    useSaveDefault(defaults, powerSideId, baseSideId, async () => {
      await refetchDefaults();
    });

  // Save override
  const { saveOverride: handleSaveOverride, loading: savingOverride } =
    useSaveOverride(
      editingOverride,
      overrideDate,
      overridePeriodType,
      overrideCapacity,
      overrideNotes,
      () => {
        refetchOverrides();
        setShowOverrideModal(false);
        setEditingOverride(null);
        setOverrideDate(format(new Date(), 'yyyy-MM-dd'));
        setOverridePeriodType('High Hybrid');
        setOverrideCapacity(0);
        setOverrideNotes('');
      }
    );

  // Delete override
  const confirmDeleteOverride = async () => {
    if (!deletingOverrideId) return;

    try {
      const { error } = await supabase
        .from('period_type_capacity_overrides')
        .delete()
        .eq('id', deletingOverrideId);

      if (error) throw error;

      refetchOverrides();
      setDeletingOverrideId(null);
    } catch (error) {
      console.error('Error deleting override:', error);
      setErrorMessage('Failed to delete override. Please try again.');
      setDeletingOverrideId(null);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Delete booking
  const {
    deleteSelectedInstances,
    deleteSeries,
    loading: deletingBookingLoading,
    error: deleteBookingError,
  } = useDeleteBooking(refetchOverrides);

  // Show error from delete booking hook
  useEffect(() => {
    if (deleteBookingError) {
      setErrorMessage(deleteBookingError);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [deleteBookingError]);

  const handleDeleteSelectedInstances = async (
    bookingId: number,
    instanceIds: number[]
  ) => {
    const success = await deleteSelectedInstances(bookingId, instanceIds);
    if (success) {
      setDeletingBooking(null);
      const newSelected = new Map(selectedInstances);
      newSelected.delete(bookingId);
      setSelectedInstances(newSelected);
    } else {
      // Error is already set in the hook
    }
  };

  const handleDeleteSeries = async (bookingId: number) => {
    const success = await deleteSeries(bookingId);
    if (success) {
      setDeletingBooking(null);
      const newSelected = new Map(selectedInstances);
      newSelected.delete(bookingId);
      setSelectedInstances(newSelected);
    } else {
      // Error is already set in the hook
    }
  };

  const toggleOverrideExpanded = (overrideId: number) => {
    const newExpanded = new Set(expandedOverrides);
    if (newExpanded.has(overrideId)) {
      newExpanded.delete(overrideId);
    } else {
      newExpanded.add(overrideId);
    }
    setExpandedOverrides(newExpanded);
  };

  const toggleInstanceSelection = (bookingId: number, instanceId: number) => {
    const newSelected = new Map(selectedInstances);
    const bookingSelected = newSelected.get(bookingId) || new Set<number>();

    if (bookingSelected.has(instanceId)) {
      bookingSelected.delete(instanceId);
    } else {
      bookingSelected.add(instanceId);
    }

    if (bookingSelected.size === 0) {
      newSelected.delete(bookingId);
    } else {
      newSelected.set(bookingId, bookingSelected);
    }

    setSelectedInstances(newSelected);
  };

  const openEditOverride = (override: PeriodTypeOverride) => {
    setEditingOverride(override);
    setOverrideDate(override.date);
    setOverridePeriodType(override.period_type);
    setOverrideCapacity(override.capacity);
    setOverrideNotes(override.notes || '');
    setShowOverrideModal(true);
  };

  const handleDeleteOverride = (id: number) => {
    setDeletingOverrideId(id);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/20 border border-red-700 rounded-md p-3 flex items-center justify-between">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-300"
            aria-label="Dismiss"
          >
            <svg
              className="w-4 h-4"
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
      )}

      {/* Defaults Section */}
      <PeriodTypeDefaultsSection
        defaults={defaults}
        onSave={handleSaveDefault}
        loading={savingDefault}
        powerSideId={powerSideId}
        baseSideId={baseSideId}
      />

      {/* Overrides Section */}
      <PeriodTypeOverridesSection
        overrides={overrides}
        expandedOverrides={expandedOverrides}
        selectedInstances={selectedInstances}
        onToggleExpanded={toggleOverrideExpanded}
        onToggleInstanceSelection={toggleInstanceSelection}
        onEdit={openEditOverride}
        onDelete={handleDeleteOverride}
        onDeleteSelectedInstances={handleDeleteSelectedInstances}
        onDeleteSeries={handleDeleteSeries}
        onAddOverride={() => {
          setEditingOverride(null);
          setOverrideDate(format(new Date(), 'yyyy-MM-dd'));
          setOverridePeriodType('High Hybrid');
          setOverrideCapacity(0);
          setOverrideNotes('');
          setShowOverrideModal(true);
        }}
        loading={deletingBookingLoading}
      />

      {/* Override Modal */}
      <OverrideModal
        isOpen={showOverrideModal}
        onClose={() => {
          setShowOverrideModal(false);
          setEditingOverride(null);
        }}
        onSave={handleSaveOverride}
        editingOverride={editingOverride}
        overrideDate={overrideDate}
        setOverrideDate={setOverrideDate}
        overridePeriodType={overridePeriodType}
        setOverridePeriodType={setOverridePeriodType}
        overrideCapacity={overrideCapacity}
        setOverrideCapacity={setOverrideCapacity}
        overrideNotes={overrideNotes}
        setOverrideNotes={setOverrideNotes}
        loading={savingOverride}
      />

      {/* Delete Override Confirmation Dialog */}
      <DeleteOverrideDialog
        isOpen={deletingOverrideId !== null}
        onClose={() => setDeletingOverrideId(null)}
        onConfirm={confirmDeleteOverride}
        loading={loading}
      />

      {/* Delete Booking Confirmation Dialog */}
      {deletingBooking && (
        <DeleteBookingDialog
          isOpen={true}
          type={deletingBooking.type}
          instanceCount={deletingBooking.instanceIds.length}
          onClose={() => setDeletingBooking(null)}
          onConfirm={async () => {
            if (deletingBooking.type === 'selected') {
              await handleDeleteSelectedInstances(
                deletingBooking.bookingId,
                deletingBooking.instanceIds
              );
            } else {
              await handleDeleteSeries(deletingBooking.bookingId);
            }
          }}
          loading={deletingBookingLoading}
        />
      )}
    </div>
  );
}
