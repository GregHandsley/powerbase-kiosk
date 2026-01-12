import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';
import clsx from 'clsx';

type Props = {
  form: UseFormReturn<BookingFormValues>;
  role: 'admin' | 'coach';
  areas: Array<{
    id: number;
    side_id: number;
    key: string;
    name: string;
  }>;
  areasLoading: boolean;
  areasError: string | null;
};

/**
 * Component for basic booking form fields (title, side, areas, color, lock)
 */
export function BookingFormFields({
  form,
  role,
  areas,
  areasLoading,
  areasError,
}: Props) {
  const filteredAreas = areas; // Could filter by side if needed

  return (
    <>
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
          {...form.register('title')}
          placeholder="e.g. Loughborough S&C – Squad A"
        />
        {form.formState.errors.title && (
          <p className="text-red-400 mt-0.5">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label className="block mb-1 font-medium">Side</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              form.setValue('sideKey', 'Power', { shouldValidate: true })
            }
            className={clsx(
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
              form.watch('sideKey') === 'Power'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900'
            )}
          >
            Power
          </button>
          <button
            type="button"
            onClick={() =>
              form.setValue('sideKey', 'Base', { shouldValidate: true })
            }
            className={clsx(
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
              form.watch('sideKey') === 'Base'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900'
            )}
          >
            Base
          </button>
        </div>
      </div>

      <div>
        <label className="block mb-1 font-medium">
          Areas{' '}
          <span className="text-[10px] text-slate-400">(Coming soon)</span>
        </label>
        <div className="border border-slate-700 rounded-md p-2 max-h-32 overflow-auto bg-slate-950/60 opacity-50 pointer-events-none">
          {areasLoading && (
            <p className="text-slate-400 text-[11px]">Loading areas…</p>
          )}
          {areasError && (
            <p className="text-red-400 text-[11px]">Error: {areasError}</p>
          )}
          {!areasLoading && !areasError && filteredAreas.length === 0 && (
            <p className="text-slate-400 text-[11px]">No areas configured.</p>
          )}
          {!areasLoading && !areasError && filteredAreas.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              {filteredAreas.map((area) => (
                <label
                  key={area.id}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400"
                >
                  <input
                    type="checkbox"
                    value={area.key}
                    disabled
                    className="h-3 w-3 rounded border-slate-600 bg-slate-950 cursor-not-allowed"
                    {...form.register('areas')}
                  />
                  <span>
                    {area.name}{' '}
                    <span className="text-slate-500">({area.key})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1 italic">
          Area selection will be available in a later update
        </p>
      </div>

      <div>
        <label className="block mb-1 font-medium">Colour</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-10 h-7 rounded border border-slate-700 bg-slate-950"
            {...form.register('color')}
          />
          <input
            className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            {...form.register('color')}
            placeholder="#4f46e5"
          />
        </div>
      </div>

      {role === 'admin' && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            id="isLocked"
            className="h-3 w-3 rounded border-slate-600 bg-slate-950"
            {...form.register('isLocked')}
          />
          <label htmlFor="isLocked" className="text-xs">
            Locked booking (coaches cannot move/modify)
          </label>
        </div>
      )}
    </>
  );
}
