import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorBase } from "./RackListEditorBase";
import { RackListEditorPower } from "./RackListEditorPower";

type Props = {
  side: "power" | "base";
  snapshot: SideSnapshot | null;
  date: string;
  time: string;
};

export function RackListEditor({ side, snapshot, date, time }: Props) {
  if (side === "base") {
    return <RackListEditorBase snapshot={snapshot} date={date} time={time} />;
  }
  return <RackListEditorPower snapshot={snapshot} date={date} time={time} />;
}

