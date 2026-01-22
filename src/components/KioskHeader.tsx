import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useBranding } from '../context/BrandingContext';

type Props = {
  title: string;
  slotLabel?: string | null;
};

export function KioskHeader({ title, slotLabel }: Props) {
  const { branding } = useBranding();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between px-6 py-3 text-sm glass-header">
      <div className="flex items-center gap-4">
        {branding?.logo_url && (
          <img
            src={branding.logo_url}
            alt="Organization logo"
            className="h-10 w-auto max-w-[220px] object-contain"
          />
        )}
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.2em] text-indigo-400">
            Powerbase
          </span>
          <span className="text-lg font-semibold text-slate-50">
            {title} — Live Platforms
          </span>
          {slotLabel && (
            <span className="text-xs text-slate-300 mt-0.5">
              Current block: {slotLabel}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">{format(now, 'HH:mm')}</div>
        <div className="text-[11px] text-slate-400">
          {format(now, 'EEE d MMM yyyy')}
        </div>
      </div>
    </div>
  );
}
