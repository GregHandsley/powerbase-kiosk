import { format } from 'date-fns';

type PlatformBooking = {
  platformNumber: number;
  nowBooking: {
    title: string;
    until: string; // ISO time string
  } | null; // null means "Available"
  nextBooking: {
    title: string;
    from: string; // ISO time string
  } | null;
};

type Props = {
  platformPages: PlatformBooking[][];
  currentCycleIndex: number;
  totalCycles: number;
  rowsPerPage: number;
  cycleLabel?: string | null;
  isLoading?: boolean;
};

/**
 * Zone B: Platform Status (Cycling)
 *
 * Purpose: PRIMARY information surface - answers "Which platform am I on, now or next?"
 *
 * Rules:
 * - Dominant visual hierarchy
 * - Cycles automatically
 * - Each cycle shows a SUBSET of platforms (e.g. 6 at a time)
 * - Platforms are the atomic unit (NOT bookings)
 *
 * Each platform tile MUST show:
 * - Platform number (largest text)
 * - NOW booking (or Available)
 * - UNTIL time (if occupied)
 * - NEXT booking
 * - FROM time
 *
 * Always show BOTH NOW and NEXT
 */
export function PlatformStatusBoard({
  platformPages,
  currentCycleIndex,
  totalCycles,
  rowsPerPage,
  cycleLabel = null,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col kiosk-surface rounded-2xl p-4">
        <div className="kiosk-kicker mb-4">Platform Status</div>
        <div className="text-slate-400 text-lg">Loading platforms...</div>
      </div>
    );
  }

  if (platformPages.length === 0) {
    return (
      <div className="h-full flex flex-col kiosk-surface rounded-2xl p-4">
        <div className="kiosk-kicker mb-4">Platform Status</div>
        <div className="text-slate-400 text-lg">No platform data</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <div className="kiosk-kicker mb-2">Platform Status</div>
        {cycleLabel ? (
          <div className="text-[clamp(12px,1.6vh,18px)] text-slate-400">
            {cycleLabel}
          </div>
        ) : totalCycles > 1 ? (
          <div className="text-[clamp(12px,1.6vh,18px)] text-slate-400">
            Showing {currentCycleIndex + 1} of {totalCycles}
          </div>
        ) : null}
      </div>

      {/* Status list */}
      <div className="flex-1 min-h-0 relative kiosk-status-list rounded-2xl">
        <QuadrantPages
          platformPages={platformPages}
          activeIndex={currentCycleIndex}
          rowsPerPage={rowsPerPage}
        />
      </div>
    </div>
  );
}

function QuadrantPages({
  platformPages,
  activeIndex,
  rowsPerPage,
}: {
  platformPages: PlatformBooking[][];
  activeIndex: number;
  rowsPerPage: number;
}) {
  return (
    <div className="absolute inset-0">
      {platformPages.map((platforms, pageIndex) => {
        const paddedPlatforms =
          platforms.length < rowsPerPage
            ? [
                ...platforms,
                ...Array.from(
                  { length: rowsPerPage - platforms.length },
                  () => null
                ),
              ]
            : platforms;
        const isActive = pageIndex === activeIndex;

        return (
          <div
            key={`quadrant-page-${pageIndex}`}
            className="absolute inset-0 flex flex-col justify-between min-h-0 kiosk-quadrant-page transition-opacity duration-300"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            {paddedPlatforms.map((platform, index) => (
              <PlatformStatusRow
                key={platform ? platform.platformNumber : `empty-${index}`}
                platform={platform}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlatformStatusRow({ platform }: { platform: PlatformBooking | null }) {
  if (!platform) {
    return (
      <div className="flex-1 min-h-0 kiosk-status-divider kiosk-status-row" />
    );
  }

  const nowUntil = platform.nowBooking
    ? format(new Date(platform.nowBooking.until), 'HH:mm')
    : platform.nextBooking
      ? format(new Date(platform.nextBooking.from), 'HH:mm')
      : null;

  const nextFrom = platform.nextBooking
    ? format(new Date(platform.nextBooking.from), 'HH:mm')
    : null;

  const nextTitle = platform.nextBooking ? platform.nextBooking.title : null;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[150px_1fr_1fr] gap-6 py-3 kiosk-status-divider kiosk-status-row items-center">
      <div>
        <div className="kiosk-kicker">Platform</div>
        <div className="text-[clamp(30px,4.2vh,60px)] font-semibold tracking-tight text-slate-100 leading-none">
          {platform.platformNumber}
        </div>
      </div>

      <div>
        <div className="kiosk-kicker mb-1">Now</div>
        <div className="text-[clamp(16px,2.2vh,30px)] font-semibold text-slate-100 leading-tight">
          {platform.nowBooking ? (
            <span className="text-slate-200">Booked</span>
          ) : (
            <span className="text-emerald-300">Available</span>
          )}
        </div>
        <div className="text-[clamp(14px,1.8vh,24px)] text-slate-300 font-mono tracking-[0.08em]">
          {nowUntil ? `until ${nowUntil}` : 'until close'}
        </div>
        {platform.nowBooking && (
          <div className="text-[clamp(12px,1.5vh,20px)] text-slate-500 leading-tight line-clamp-2">
            {platform.nowBooking.title}
          </div>
        )}
      </div>

      <div>
        {nextTitle && <div className="kiosk-kicker mb-1">Next</div>}
        {nextTitle && (
          <div className="text-[clamp(13px,1.9vh,26px)] font-medium text-slate-300 leading-tight line-clamp-2">
            {nextTitle}
          </div>
        )}
        {nextFrom && (
          <div className="text-[clamp(12px,1.6vh,22px)] text-slate-400 font-mono tracking-[0.08em]">
            from {nextFrom}
          </div>
        )}
      </div>
    </div>
  );
}
