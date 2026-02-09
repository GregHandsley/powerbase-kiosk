import type { ReactNode } from 'react';
import { KioskHeader } from './KioskHeader';
import type { SideKey } from '../nodes/data/sidesNodes';

type Props = {
  title: string;
  slotLabel?: string | null;
  sideKey?: SideKey;
  children: ReactNode;
};

export function KioskFrame({ title, slotLabel, sideKey, children }: Props) {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 kiosk-page">
      <KioskHeader
        title={title}
        slotLabel={slotLabel ?? undefined}
        sideKey={sideKey}
      />
      <div className="flex-1 kiosk-surface flex items-center justify-center px-3 py-3 md:px-5 md:py-4">
        {children}
      </div>
    </div>
  );
}
