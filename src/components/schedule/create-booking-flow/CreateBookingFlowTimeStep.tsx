import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';
import type { useCapacityValidation } from '../../admin/booking/useCapacityValidation';
import type { ClosedPeriod } from '../../admin/capacity/useClosedTimes';
import { BookingTimeInputs } from '../../admin/booking/BookingTimeInputs';
import { CapacityDisplay } from '../../admin/booking/CapacityDisplay';
import { inputClass } from './constants';
import type { BookingFamily, BookingSquad } from './types';

type WeekManagement = {
  currentWeekCapacity: number;
  capacityByWeek: Map<number, number>;
  setCapacityByWeek: (m: Map<number, number>) => void;
  handleCapacityChange: (num: number) => void;
};

type Props = {
  form: UseFormReturn<BookingFormValues>;
  sideKey: 'Power' | 'Base';
  startDate: string | undefined;
  startTime: string | undefined;
  endTime: string | undefined;
  bookingType: 'catalogue' | 'one_off';
  selectedFamilyId: number | null;
  selectedSquadId: number | null;
  oneOffName: string;
  closedTimes: Set<string>;
  closedPeriods: ClosedPeriod[];
  firstAvailableTime: string;
  endTimeManuallyChanged: boolean;
  onEndTimeChange: () => void;
  weekManagement: WeekManagement;
  capacityValidation: ReturnType<typeof useCapacityValidation>;
  bookingFamilies: BookingFamily[];
  bookingSquads: BookingSquad[];
  filteredSquads: BookingSquad[];
  selectedSquad: BookingSquad | null;
  bookingFamiliesLoading: boolean;
  weeksTooltipVisible: boolean;
  setWeeksTooltipVisible: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function CreateBookingFlowTimeStep({
  form,
  sideKey,
  startDate,
  startTime,
  endTime,
  bookingType,
  selectedFamilyId,
  selectedSquadId,
  // oneOffName,
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
  // selectedSquad,
  bookingFamiliesLoading,
  weeksTooltipVisible,
  setWeeksTooltipVisible,
  onSubmit,
}: Props) {
  return (
    <>
      <p className="text-sm text-slate-400 -mt-2">
        Set when the booking takes place. Capacity is assessed for this time
        only.
      </p>
      <form
        className="grid gap-6 md:grid-cols-[1fr,minmax(240px,320px)] text-sm"
        onSubmit={onSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-slate-300 font-medium">
              Booking Owner
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  form.setValue('bookingType', 'catalogue', {
                    shouldValidate: true,
                  })
                }
                disabled={
                  bookingFamilies.length === 0 || bookingSquads.length === 0
                }
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  bookingType === 'catalogue'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                Squad Session
              </button>
              <button
                type="button"
                onClick={() =>
                  form.setValue('bookingType', 'one_off', {
                    shouldValidate: true,
                  })
                }
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  bookingType === 'one_off'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                Ad-hoc Session
              </button>
            </div>
          </div>

          {bookingType === 'catalogue' && (
            <>
              <div>
                <label className="block mb-2 text-slate-300 font-medium">
                  Family
                </label>
                <select
                  className={inputClass}
                  value={selectedFamilyId ?? ''}
                  onChange={(e) =>
                    form.setValue(
                      'squadFamilyId',
                      e.target.value ? Number(e.target.value) : null,
                      { shouldValidate: true }
                    )
                  }
                >
                  <option value="">
                    {bookingFamiliesLoading ? 'Loading...' : 'Select family'}
                  </option>
                  {bookingFamilies.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 text-slate-300 font-medium">
                  Squad
                </label>
                <select
                  className={inputClass}
                  value={selectedSquadId ?? ''}
                  onChange={(e) =>
                    form.setValue(
                      'squadId',
                      e.target.value ? Number(e.target.value) : null,
                      { shouldValidate: true }
                    )
                  }
                  disabled={!selectedFamilyId}
                >
                  <option value="">
                    {selectedFamilyId ? 'Select squad' : 'Select family first'}
                  </option>
                  {filteredSquads.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {bookingType === 'one_off' && (
            <div>
              <label className="block mb-2 text-slate-300 font-medium">
                Booking name
              </label>
              <input
                className={inputClass}
                {...form.register('oneOffName')}
                placeholder="e.g. Open session"
              />
            </div>
          )}

          <div>
            <label className="block mb-2 text-slate-300 font-medium">
              Side
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  form.setValue('sideKey', 'Power', { shouldValidate: true })
                }
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  sideKey === 'Power'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                Power
              </button>
              <button
                type="button"
                onClick={() =>
                  form.setValue('sideKey', 'Base', { shouldValidate: true })
                }
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  sideKey === 'Base'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                Base
              </button>
            </div>
          </div>

          <BookingTimeInputs
            form={form}
            closedTimes={closedTimes}
            closedPeriods={closedPeriods}
            firstAvailableTime={firstAvailableTime}
            endTimeManuallyChanged={endTimeManuallyChanged}
            onEndTimeChange={onEndTimeChange}
            hideWeeks
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block mb-2 text-slate-300 font-medium">
                Number of Weeks
              </label>
              <div
                className={
                  bookingType === 'one_off' ? 'relative block w-full' : ''
                }
                onMouseEnter={() =>
                  bookingType === 'one_off' && setWeeksTooltipVisible(true)
                }
                onMouseLeave={() => setWeeksTooltipVisible(false)}
              >
                <input
                  type="number"
                  min={1}
                  max={16}
                  readOnly={bookingType === 'one_off'}
                  className={`${inputClass} ${
                    bookingType === 'one_off'
                      ? 'cursor-not-allowed opacity-60 bg-slate-800 text-slate-400'
                      : ''
                  }`}
                  {...form.register('weeks', { valueAsNumber: true })}
                />
                {bookingType === 'one_off' && weeksTooltipVisible && (
                  <div
                    className="absolute left-0 right-0 top-full z-[200] mt-1 min-w-[160px] rounded-md border border-indigo-300/70 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.85)] ring-1 ring-indigo-400/30"
                    role="tooltip"
                  >
                    <div className="text-slate-200">
                      Ad-hoc bookings occur once only. Weekly repeats are not
                      available.
                    </div>
                  </div>
                )}
              </div>
              {form.formState.errors.weeks && (
                <p className="text-red-400 mt-1 text-xs">
                  {form.formState.errors.weeks.message}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-2 text-slate-300 font-medium">
                Number of athletes
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={weekManagement.currentWeekCapacity}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  const num =
                    !isNaN(value) && value >= 1 && value <= 100 ? value : 1;
                  weekManagement.handleCapacityChange(num);
                }}
                className={inputClass}
              />
              {form.formState.errors.capacity && (
                <p className="text-red-400 mt-1 text-xs">
                  {form.formState.errors.capacity.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 md:pt-0">
          {startDate && startTime && endTime && (
            <div className="capacity-card-no-shadow rounded-xl p-4">
              <CapacityDisplay
                validationResult={capacityValidation}
                proposedCapacity={weekManagement.currentWeekCapacity}
                capacityByWeek={weekManagement.capacityByWeek}
                onCapacityChange={(weekIndex, value) => {
                  const m = new Map(weekManagement.capacityByWeek);
                  m.set(weekIndex, value);
                  weekManagement.setCapacityByWeek(m);
                }}
              />
            </div>
          )}
        </div>
      </form>
    </>
  );
}
