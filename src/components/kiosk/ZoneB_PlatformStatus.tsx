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
      <div className="mb-6">
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
      <div className="flex-1 min-h-0 relative overflow-hidden">
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
            className="absolute inset-0 flex flex-col gap-2 min-h-0 kiosk-quadrant-page overflow-hidden"
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
    return <div className="flex-1 min-h-0" />;
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
    <div
      className="kiosk-platform-card flex-1 min-h-0 max-h-full grid grid-cols-[160px_1fr_1fr] grid-rows-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 px-2 py-1.5 overflow-hidden"
      style={{
        border: '2px solid transparent',
        backgroundImage: `
          linear-gradient(transparent 1px, transparent 1px),
          linear-gradient(90deg, transparent 1px, transparent 1px)
        `,
        backgroundSize: 'calc(100% / 3) calc(100% / 3)',
      }}
    >
      {/* Row 1: Labels - all inline */}
      <div className="kiosk-kicker min-w-0 relative">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          A
        </span>
        Platform
      </div>
      <div className="kiosk-kicker min-w-0 relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          B
        </span>
        Now
      </div>
      <div className="kiosk-kicker min-w-0 relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          C
        </span>
        {nextTitle ? 'Next' : ''}
      </div>

      {/* Row 2: Main content - Platform number spans D and G, Booking name, Next booking */}
      <div className="flex items-end justify-start min-w-0 overflow-hidden relative row-span-2">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          D+G
        </span>
        <div
          className="font-semibold tracking-tight text-slate-50 leading-none"
          style={{
            fontSize: 'clamp(56px, 8.5vh, 120px)',
            lineHeight: '0.85',
          }}
        >
          {platform.platformNumber}
        </div>
      </div>
      <div className="flex items-center justify-start min-w-0 overflow-hidden relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          E
        </span>
        <div className="font-semibold text-slate-50 leading-tight min-w-0 w-full">
          {platform.nowBooking ? (
            <span
              className="text-slate-100 leading-snug break-words"
              style={{
                fontSize: 'clamp(12px, 1.8vh, 28px)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {platform.nowBooking.title}
            </span>
          ) : (
            <span className="text-emerald-400 truncate block text-[clamp(17px,2.4vh,32px)]">
              Available
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-start min-w-0 overflow-hidden relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          F
        </span>
        {nextTitle && (
          <div
            className="font-medium text-slate-300 leading-snug min-w-0 w-full"
            style={{
              fontSize: 'clamp(11px, 1.6vh, 24px)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {nextTitle}
          </div>
        )}
      </div>

      {/* Row 3: Time info - G is now part of platform number cell above */}
      <div className="flex items-center justify-start min-w-0 overflow-hidden relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          H
        </span>
        <div className="text-[clamp(13px,1.9vh,22px)] text-slate-400 font-mono tracking-[0.1em] min-w-0 whitespace-nowrap">
          {nowUntil ? `until ${nowUntil}` : 'until close'}
        </div>
      </div>
      <div className="flex items-center justify-start min-w-0 overflow-hidden relative pl-0">
        <span className="absolute top-0 left-0 text-xs text-blue-400 font-bold opacity-0">
          I
        </span>
        <div className="text-[clamp(12px,1.7vh,20px)] text-slate-500 font-mono tracking-[0.1em] min-w-0 whitespace-nowrap">
          {nextFrom ? `from ${nextFrom}` : ''}
        </div>
      </div>
    </div>
  );
}
