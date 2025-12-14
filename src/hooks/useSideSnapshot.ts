import { useQuery } from "@tanstack/react-query";
import { getSideIdByKeyNode, type SideKey } from "../nodes/data/sidesNodes";
import { getInstancesAtNode } from "../nodes/data/instancesNodes";
import { computeSnapshotFromInstances } from "../nodes/logic/computeSnapshot";
import type { SideSnapshot } from "../types/snapshot";

type UseSideSnapshotResult = {
  snapshot: SideSnapshot | null;
  error: string | null;
  isLoading: boolean;
};

export function useSideSnapshot(
  sideKey: SideKey,
  at?: Date
): UseSideSnapshotResult {
  const query = useQuery({
    queryKey: ["snapshot", sideKey, at ? at.toISOString() : null],
    queryFn: async () => {
      const effectiveAtIso = (at ?? new Date()).toISOString();
      const sideId = await getSideIdByKeyNode(sideKey);
      const { data, error } = await getInstancesAtNode(sideId, effectiveAtIso);

      if (error) {
        console.error("getInstancesAtNode error", error.message);
        throw new Error(error.message);
      }

      return computeSnapshotFromInstances(data ?? [], effectiveAtIso);
    },
    refetchInterval: 20_000, // 20s auto-refresh
  });

  return {
    snapshot: (query.data as SideSnapshot | undefined) ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    isLoading: query.isLoading,
  };
}
