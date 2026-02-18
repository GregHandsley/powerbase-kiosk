import { useEffect, useMemo, useRef, useState } from 'react';
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
  const padPageRows = useMemo(
    () => (page: PlatformBooking[] | undefined | null) => {
      const safePage = page ?? [];
      if (safePage.length >= rowsPerPage) return safePage.slice(0, rowsPerPage);
      return [
        ...safePage,
        ...Array.from({ length: rowsPerPage - safePage.length }, () => null),
      ];
    },
    [rowsPerPage]
  );
  const currentPlatforms = useMemo(
    () => padPageRows(platformPages[currentCycleIndex]),
    [padPageRows, platformPages, currentCycleIndex]
  );
  const previousCycleIndexRef = useRef(currentCycleIndex);
  const [transitionFromPlatforms, setTransitionFromPlatforms] = useState<
    (PlatformBooking | null)[] | null
  >(null);
  const [isCycleTransitioning, setIsCycleTransitioning] = useState(false);
  const [cycleFlipId, setCycleFlipId] = useState(0);

  useEffect(() => {
    if (previousCycleIndexRef.current === currentCycleIndex) return;

    const fromPlatforms = padPageRows(
      platformPages[previousCycleIndexRef.current] ?? []
    );
    setTransitionFromPlatforms(fromPlatforms);
    setIsCycleTransitioning(true);
    setCycleFlipId((prev) => prev + 1);
    previousCycleIndexRef.current = currentCycleIndex;

    const timer = window.setTimeout(() => {
      setIsCycleTransitioning(false);
      setTransitionFromPlatforms(null);
    }, 760);

    return () => window.clearTimeout(timer);
  }, [currentCycleIndex, padPageRows, platformPages]);

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
      <div className="mb-3">
        <div className="kiosk-kicker mb-1">Platform Status</div>
        {cycleLabel ? (
          <div className="text-[clamp(11px,1.3vh,15px)] text-slate-400">
            {cycleLabel}
          </div>
        ) : totalCycles > 1 ? (
          <div className="text-[clamp(11px,1.3vh,15px)] text-slate-400">
            Showing {currentCycleIndex + 1} of {totalCycles}
          </div>
        ) : null}
      </div>

      {/* Status list */}
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        {currentPlatforms.map((platform, index) => (
          <PlatformStatusRow
            key={platform ? platform.platformNumber : `empty-${index}`}
            platform={platform}
            flipFromPlatform={transitionFromPlatforms?.[index] ?? null}
            animateCycleFlip={isCycleTransitioning}
            cycleFlipId={cycleFlipId}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformStatusRow({
  platform,
  flipFromPlatform,
  animateCycleFlip,
  cycleFlipId,
}: {
  platform: PlatformBooking | null;
  flipFromPlatform: PlatformBooking | null;
  animateCycleFlip: boolean;
  cycleFlipId: number;
}) {
  if (!platform) {
    return <div className="flex-1 min-h-0" />;
  }

  const currentUntil = platform.nowBooking
    ? format(new Date(platform.nowBooking.until), 'HH:mm')
    : null;

  const nextFrom = platform.nextBooking
    ? format(new Date(platform.nextBooking.from), 'HH:mm')
    : null;

  const nextTitle = platform.nextBooking ? platform.nextBooking.title : null;
  const isLive = !!platform.nowBooking;
  const bookingLogoUrl = isLive ? '/lboro-sport.svg' : null;
  const hasBadge = !!bookingLogoUrl;
  const fromNumber = flipFromPlatform?.platformNumber ?? null;
  const shouldAnimateNumberFlip =
    animateCycleFlip &&
    fromNumber !== null &&
    fromNumber !== platform.platformNumber;

  return (
    <div
      className="kiosk-platform-card flex-1 min-h-0 max-h-full grid gap-2 px-2.5 py-1.5 overflow-hidden"
      style={{ gridTemplateColumns: '116px minmax(0,1fr)' }}
    >
      <div className="kiosk-platform-identity kiosk-platform-identity--single">
        {shouldAnimateNumberFlip ? (
          <div className="kiosk-number-cycle-flip">
            <div
              key={`${cycleFlipId}-${platform.platformNumber}-${fromNumber}`}
              className="kiosk-number-cycle-flip-inner"
            >
              <div className="kiosk-number-cycle-face kiosk-number-cycle-front">
                <div className="kiosk-platform-number-display">
                  {fromNumber}
                </div>
              </div>
              <div className="kiosk-number-cycle-face kiosk-number-cycle-back">
                <div className="kiosk-platform-number-display">
                  {platform.platformNumber}
                </div>
              </div>
            </div>
          </div>
        ) : hasBadge ? (
          <div className="kiosk-platform-flip">
            <div className="kiosk-platform-flip-inner">
              <div className="kiosk-platform-flip-face kiosk-platform-flip-front">
                <div className="kiosk-platform-number-display">
                  {platform.platformNumber}
                </div>
              </div>
              <div className="kiosk-platform-flip-face kiosk-platform-flip-back">
                <img
                  src={bookingLogoUrl}
                  alt="Club badge"
                  className="kiosk-logo-badge-image"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="kiosk-platform-number-display">
            {platform.platformNumber}
          </div>
        )}
      </div>

      <div className="min-w-0 h-full grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)] gap-1 py-0.25">
        {isLive ? (
          <div className="min-w-0 h-full rounded-md px-2 py-1.5 border border-sky-400/30 bg-gradient-to-r from-sky-500/12 to-indigo-500/10 flex items-center">
            <div className="min-w-0 w-full flex flex-col justify-center gap-1">
              <span
                className="text-slate-100 leading-snug break-words font-semibold min-w-0"
                style={{
                  fontSize: 'clamp(15px, 2vh, 26px)',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {platform.nowBooking?.title}
              </span>
              {currentUntil && (
                <div className="text-[clamp(10px,1.1vh,14px)] text-sky-200 font-mono tracking-[0.06em]">
                  Until {currentUntil}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0 h-full rounded-md px-2 py-1.5 border bg-emerald-500/10 border-emerald-400/30 flex items-center">
            <div className="min-w-0 w-full flex flex-col justify-center gap-1">
              <span className="text-emerald-300 truncate block text-[clamp(15px,2vh,26px)] font-semibold">
                Available
              </span>
            </div>
          </div>
        )}

        <div className="min-w-0 h-full rounded-md px-2 py-1 border border-slate-700/70 bg-slate-900/25 flex items-center overflow-hidden">
          {nextTitle ? (
            <div className="min-w-0 w-full flex flex-col justify-center gap-0.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="text-[clamp(9px,0.9vh,11px)] uppercase tracking-[0.12em] text-slate-500">
                  Next booking
                </div>
                {nextFrom && (
                  <div className="text-[clamp(9px,0.95vh,12px)] text-slate-400 font-mono tracking-[0.05em] whitespace-nowrap">
                    From {nextFrom}
                  </div>
                )}
              </div>
              <div
                className="font-medium text-slate-300 leading-snug min-w-0 w-full"
                style={{
                  fontSize: 'clamp(12px, 1.35vh, 17px)',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {nextTitle}
              </div>
            </div>
          ) : (
            <div className="min-w-0 w-full flex items-center">
              <div className="text-slate-500 text-[clamp(11px,1.25vh,15px)]">
                No upcoming booking
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
