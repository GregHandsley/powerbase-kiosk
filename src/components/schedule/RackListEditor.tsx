import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorBase } from "./RackListEditorBase";
import { RackListEditorPower } from "./RackListEditorPower";

type Props = {
  side: "power" | "base";
  snapshot: SideSnapshot | null;
};

export function RackListEditor({ side, snapshot }: Props) {
  if (side === "base") {
    return <RackListEditorBase snapshot={snapshot} />;
  }
  return <RackListEditorPower snapshot={snapshot} />;
}

