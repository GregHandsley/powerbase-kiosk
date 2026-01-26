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
  platforms: PlatformBooking[];
  currentCycleIndex: number;
  totalCycles: number;
  rotationSeconds: number;
  nowTimeIso: string;
  isFading: boolean;
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
  platforms,
  currentCycleIndex,
  totalCycles,
  rotationSeconds,
  nowTimeIso,
  isFading,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-4">
          Platform Status
        </div>
        <div className="text-slate-400 text-lg">Loading platforms...</div>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-4">
          Platform Status
        </div>
        <div className="text-slate-400 text-lg">No platform data</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-1">
          Platform Status
        </div>
        {totalCycles > 1 && (
          <div className="text-sm text-slate-400">
            Showing {currentCycleIndex + 1} of {totalCycles} · Details rotate
            every {rotationSeconds}s
          </div>
        )}
      </div>

      {/* Status list */}
      <div
        className={`flex-1 flex flex-col justify-start transition-opacity duration-300 ${
          isFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {platforms.map((platform) => (
          <PlatformStatusRow
            key={platform.platformNumber}
            platform={platform}
            nowTimeIso={nowTimeIso}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformStatusRow({
  platform,
  nowTimeIso,
}: {
  platform: PlatformBooking;
  nowTimeIso: string;
}) {
  const nowUntil = platform.nowBooking
    ? format(new Date(platform.nowBooking.until), 'HH:mm')
    : platform.nextBooking
      ? format(new Date(platform.nextBooking.from), 'HH:mm')
      : null;

  const nextFrom = platform.nextBooking
    ? format(new Date(platform.nextBooking.from), 'HH:mm')
    : format(new Date(nowTimeIso), 'HH:mm');

  const nextTitle = platform.nextBooking
    ? platform.nextBooking.title
    : 'Open access';

  return (
    <div className="grid grid-cols-[160px_1fr_1fr] gap-6 py-4 border-b border-slate-800 last:border-b-0">
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">
          Platform
        </div>
        <div className="text-5xl font-semibold text-slate-100">
          {platform.platformNumber}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-1">
          Now
        </div>
        <div className="text-2xl font-semibold text-slate-100">
          {platform.nowBooking ? (
            platform.nowBooking.title
          ) : (
            <span className="text-emerald-400">Available</span>
          )}
        </div>
        <div className="text-lg text-slate-400 font-mono">
          {nowUntil ? `until ${nowUntil}` : 'until close'}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-1">
          Next
        </div>
        <div className="text-xl font-medium text-slate-200">{nextTitle}</div>
        <div className="text-lg text-slate-400 font-mono">from {nextFrom}</div>
      </div>
    </div>
  );
}
