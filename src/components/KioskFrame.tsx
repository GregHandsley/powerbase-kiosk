import type { ReactNode } from "react";
import { KioskHeader } from "./KioskHeader";

type Props = {
  title: string;
  slotLabel?: string | null;
  children: ReactNode;
};

export function KioskFrame({ title, slotLabel, children }: Props) {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-50 kiosk-page">
      <KioskHeader title={title} slotLabel={slotLabel ?? undefined} />
      <div className="flex-1 kiosk-gradient flex items-center justify-center px-2 py-2 md:px-4 md:py-3">
        {children}
      </div>
    </div>
  );
}

