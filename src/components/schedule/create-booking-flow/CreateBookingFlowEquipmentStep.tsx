import clsx from 'clsx';
import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';
import type { useWeekManagement } from '../../admin/booking/useWeekManagement';
import { BookingPlatformSelection } from '../../admin/booking/BookingPlatformSelection';
import { BookingBuilderPanel } from '../../admin/booking/BookingBuilderPanel';
import { MiniAreasFloorplan } from '../../shared/MiniAreasFloorplan';

type AreaSlot = { area_key: string; start: string; end: string };
type PlatformSlot = { rackNumber: number; start: string; end: string };
type AreaOption = { id: number; side_id: number; key: string; name: string };

type Props = {
  form: UseFormReturn<BookingFormValues>;
  sideKey: 'Power' | 'Base';
  sideId: number | null;
  startTime: string | undefined;
  endTime: string | undefined;
  areaSlots: AreaSlot[] | undefined;
  platformSlots: PlatformSlot[] | undefined;
  areas: AreaOption[];
  bookedAreaKeys: Set<string>;
  freeIntervalsByArea: Map<string, Array<{ start: string; end: string }>>;
  freeIntervalsByRack: Map<number, Array<{ start: string; end: string }>>;
  onFreeIntervalsComputed: (
    map: Map<number, Array<{ start: string; end: string }>>
  ) => void;
  weekManagement: ReturnType<typeof useWeekManagement>;
  hasAnyRacksOrAreas: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitError: string | null;
};

export function CreateBookingFlowEquipmentStep({
  form,
  sideKey,
  sideId,
  startTime,
  endTime,
  areaSlots,
  platformSlots,
  areas,
  bookedAreaKeys,
  freeIntervalsByArea,
  freeIntervalsByRack,
  onFreeIntervalsComputed,
  weekManagement,
  hasAnyRacksOrAreas,
  onSubmit,
  submitError,
}: Props) {
  return (
    <form
      className={clsx('flex flex-col space-y-3', 'flex-1 min-h-0')}
      onSubmit={(e) => {
        e.preventDefault();
        if (!hasAnyRacksOrAreas) {
          form.setError('racksInput', {
            message: 'Add at least one area or platform to create a booking.',
          });
          return;
        }
        onSubmit(e);
      }}
    >
      <div className={clsx('grid gap-4 md:grid-cols-2', 'flex-1 min-h-0')}>
        <div
          className={clsx('space-y-3 flex flex-col', 'min-h-0 overflow-hidden')}
        >
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Platforms & racks
            </h3>
            <BookingPlatformSelection
              form={form}
              sideKey={sideKey}
              weekManagement={weekManagement}
              hideCapacityInput
              hideLabel
              hideRacksInputError
              onFreeIntervalsComputed={onFreeIntervalsComputed}
            />
          </div>

          {sideId != null && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 flex flex-col px-2">
              <h3 className="text-sm font-semibold text-slate-200 mb-2 flex-shrink-0 pt-2">
                Other areas
              </h3>
              <div className="min-h-[280px] h-[320px] w-full">
                <MiniAreasFloorplan
                  sideKey={sideKey}
                  selectedAreaKeys={(areaSlots ?? []).map((s) => s.area_key)}
                  onAreaClick={(areaKey) => {
                    const slots = form.getValues('areaSlots') ?? [];
                    if (slots.some((s) => s.area_key === areaKey)) {
                      form.setValue(
                        'areaSlots',
                        slots.filter((s) => s.area_key !== areaKey)
                      );
                      return;
                    }
                    const interval = freeIntervalsByArea.get(areaKey)?.[0];
                    form.setValue('areaSlots', [
                      ...slots,
                      {
                        area_key: areaKey,
                        start: interval?.start ?? startTime ?? '07:00',
                        end: interval?.end ?? endTime ?? '08:30',
                      },
                    ]);
                  }}
                  bookedAreaKeys={bookedAreaKeys}
                  freeIntervalsByArea={freeIntervalsByArea}
                  areaKeysFilter={areas
                    .filter((a) => a.side_id === sideId)
                    .map((a) => a.key)}
                />
              </div>
            </div>
          )}
        </div>

        <div className={clsx('flex flex-col', 'min-h-0 overflow-hidden')}>
          <BookingBuilderPanel
            sideKey={sideKey}
            windowStartTime={startTime ?? '07:00'}
            windowEndTime={endTime ?? '08:30'}
            areaSlots={areaSlots ?? []}
            onChangeAreaSlots={(slots) => form.setValue('areaSlots', slots)}
            platformSlots={platformSlots ?? []}
            onChangePlatformSlots={(slots) =>
              form.setValue('platformSlots', slots)
            }
            weekManagement={weekManagement}
            areas={areas}
            partiallyAvailableRackNumbers={new Set(freeIntervalsByRack.keys())}
            freeIntervalsByRack={freeIntervalsByRack}
            freeIntervalsByArea={freeIntervalsByArea}
          />
        </div>
      </div>

      <div className="flex-shrink-0 space-y-3">
        {submitError && (
          <pre className="rounded-lg bg-red-900/20 border border-red-700/50 p-3 text-sm text-red-300 whitespace-pre-wrap">
            {submitError}
          </pre>
        )}
      </div>
    </form>
  );
}
