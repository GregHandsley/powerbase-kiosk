/**
 * Sprint 6: Time-first, equipment-equal create booking flow.
 * Refactored into smaller components under create-booking-flow/.
 */

import clsx from 'clsx';
import { Modal } from '../shared/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../../hooks/usePermissions';
import { useCreateBookingFlow } from './create-booking-flow/useCreateBookingFlow';
import { CreateBookingFlowStepIndicator } from './create-booking-flow/CreateBookingFlowStepIndicator';
import { CreateBookingFlowTimeStep } from './create-booking-flow/CreateBookingFlowTimeStep';
import { CreateBookingFlowEquipmentStep } from './create-booking-flow/CreateBookingFlowEquipmentStep';
import { CreateBookingFlowReviewStep } from './create-booking-flow/CreateBookingFlowReviewStep';
import { CreateBookingFlowFooter } from './create-booking-flow/CreateBookingFlowFooter';
import { PartialWindowConfirmModal } from './create-booking-flow/PartialWindowConfirmModal';
import { FinalConfirmModal } from './create-booking-flow/FinalConfirmModal';
import {
  STEP_TIME,
  STEP_EQUIPMENT,
  STEP_REVIEW,
} from './create-booking-flow/constants';
import type { CreateBookingFlowProps } from './create-booking-flow/types';

export function CreateBookingFlowModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialSide,
  initialRacks,
}: CreateBookingFlowProps) {
  const { user } = useAuth();
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreateBookings } = usePermission(
    primaryOrgId,
    'bookings.create'
  );

  const flow = useCreateBookingFlow({
    isOpen,
    onClose,
    onSuccess,
    role,
    initialDate,
    initialStartTime,
    initialEndTime,
    initialSide,
    initialRacks,
    userId: user?.id ?? null,
    primaryOrgId,
  });

  if (!canCreateBookings) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} lockScroll>
        <p className="text-slate-400">
          You don&apos;t have permission to create bookings.
        </p>
      </Modal>
    );
  }

  const {
    form,
    step,
    weeksTooltipVisible,
    setWeeksTooltipVisible,
    partialWindowConfirm,
    setPartialWindowConfirm,
    finalConfirmValues,
    setFinalConfirmValues,
    sideKey,
    sideId,
    startDate,
    startTime,
    endTime,
    capacity,
    bookingType,
    selectedFamilyId,
    selectedSquadId,
    oneOffName,
    areaSlots,
    platformSlots,
    closedTimes,
    closedPeriods,
    firstAvailableTime,
    endTimeManuallyChanged,
    onEndTimeChange,
    weekManagement,
    capacityValidation,
    bookingFamilies,
    bookingSquads,
    filteredSquads,
    selectedSquad,
    bookingFamiliesLoading,
    areas,
    bookedAreaKeys,
    freeIntervalsByArea,
    freeIntervalsByRack,
    handleFreeIntervalsComputed,
    canGoToEquipment,
    hasAnyRacksOrAreas,
    handleNext,
    handleBack,
    setStep,
    reviewConflicts,
    reviewConflictsLoading,
    reviewConflictsError,
    submitError,
    submitting,
    onSubmit,
    setFormError,
    handleConfirmCreate,
    handleEditWeek,
  } = flow;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="5xl"
        lockScroll
        className="!h-[90vh] !flex !flex-col"
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-shrink-0 flex flex-col gap-1 pb-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-100 tracking-tight">
                Create booking
              </h2>
              <CreateBookingFlowStepIndicator step={step} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div
              className={clsx(
                'flex flex-col space-y-4',
                step === STEP_EQUIPMENT ? '' : 'flex-1 min-h-0'
              )}
            >
              {step === STEP_TIME && (
                <CreateBookingFlowTimeStep
                  form={form}
                  sideKey={sideKey}
                  startDate={startDate}
                  startTime={startTime}
                  endTime={endTime}
                  bookingType={bookingType}
                  selectedFamilyId={selectedFamilyId ?? null}
                  selectedSquadId={selectedSquadId ?? null}
                  oneOffName={oneOffName ?? ''}
                  closedTimes={closedTimes}
                  closedPeriods={closedPeriods ?? []}
                  firstAvailableTime={firstAvailableTime}
                  endTimeManuallyChanged={endTimeManuallyChanged}
                  onEndTimeChange={onEndTimeChange}
                  weekManagement={weekManagement}
                  capacityValidation={capacityValidation}
                  bookingFamilies={bookingFamilies}
                  bookingSquads={bookingSquads}
                  filteredSquads={filteredSquads}
                  selectedSquad={selectedSquad}
                  bookingFamiliesLoading={bookingFamiliesLoading}
                  weeksTooltipVisible={!!weeksTooltipVisible}
                  setWeeksTooltipVisible={setWeeksTooltipVisible}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNext();
                  }}
                />
              )}

              {step === STEP_EQUIPMENT && (
                <CreateBookingFlowEquipmentStep
                  form={form}
                  sideKey={sideKey}
                  sideId={sideId}
                  startTime={startTime}
                  endTime={endTime}
                  areaSlots={areaSlots}
                  platformSlots={platformSlots}
                  areas={areas}
                  bookedAreaKeys={bookedAreaKeys}
                  freeIntervalsByArea={freeIntervalsByArea}
                  freeIntervalsByRack={freeIntervalsByRack}
                  onFreeIntervalsComputed={handleFreeIntervalsComputed}
                  weekManagement={weekManagement}
                  hasAnyRacksOrAreas={hasAnyRacksOrAreas}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStep(STEP_REVIEW);
                  }}
                  submitError={submitError}
                />
              )}

              {step === STEP_REVIEW && (
                <CreateBookingFlowReviewStep
                  form={form}
                  startDate={startDate}
                  startTime={startTime}
                  endTime={endTime}
                  platformSlots={platformSlots}
                  areaSlots={areaSlots}
                  capacity={capacity}
                  weekManagement={weekManagement}
                  capacityValidation={capacityValidation}
                  reviewConflicts={reviewConflicts}
                  reviewConflictsLoading={reviewConflictsLoading}
                  reviewConflictsError={reviewConflictsError}
                  submitError={submitError}
                  onEditWeek={handleEditWeek}
                />
              )}
            </div>
          </div>

          <CreateBookingFlowFooter
            step={step}
            onClose={onClose}
            onBack={handleBack}
            onNext={handleNext}
            canGoToEquipment={!!canGoToEquipment}
            hasAnyRacksOrAreas={!!hasAnyRacksOrAreas}
            setStep={setStep}
            formErrors={{
              racksInput: form.formState.errors.racksInput,
              areaSlots: form.formState.errors.areaSlots,
            }}
            setFormError={setFormError}
            reviewConflictsCount={reviewConflicts.length}
            reviewConflictsLoading={reviewConflictsLoading}
            capacityValid={!!capacityValidation.isValid}
            submitting={submitting}
            onConfirmCreate={handleConfirmCreate}
          />
        </div>
      </Modal>

      <PartialWindowConfirmModal
        values={partialWindowConfirm}
        onClose={() => setPartialWindowConfirm(null)}
        onSubmit={(values) => {
          setPartialWindowConfirm(null);
          onSubmit(values);
        }}
        submitting={submitting}
      />

      <FinalConfirmModal
        values={finalConfirmValues}
        onClose={() => setFinalConfirmValues(null)}
        onSubmit={(values) => {
          setFinalConfirmValues(null);
          onSubmit(values);
        }}
        submitting={submitting}
      />
    </>
  );
}
