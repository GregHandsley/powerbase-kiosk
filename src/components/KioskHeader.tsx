import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useBranding } from '../context/BrandingContext';
import { KioskCapacityDisplay } from './KioskCapacityDisplay';
import type { SideKey } from '../nodes/data/sidesNodes';

type Props = {
  title: string;
  slotLabel?: string | null;
  sideKey?: SideKey;
};

export function KioskHeader({ title, slotLabel, sideKey }: Props) {
  const { branding } = useBranding();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between px-6 py-3 text-sm kiosk-header">
      <div className="flex items-center gap-5">
        {branding?.logo_url && (
          <img
            src={branding.logo_url}
            alt="Organization logo"
            className="h-9 w-auto max-w-[200px] object-contain"
          />
        )}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
            Powerbase
          </span>
          <span className="text-base font-medium text-slate-100">
            {title} — Live Platforms
          </span>
          {slotLabel && (
            <span className="text-[11px] text-slate-400 mt-1">
              Current block: {slotLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-7">
        {sideKey && (
          <div className="text-right">
            <KioskCapacityDisplay sideKey={sideKey} currentTime={now} />
          </div>
        )}
        <div className="text-right">
          <div className="text-base font-medium text-slate-100">
            {format(now, 'HH:mm')}
          </div>
          <div className="text-[11px] text-slate-500">
            {format(now, 'EEE d MMM yyyy')}
          </div>
        </div>
      </div>
    </div>
  );
}
