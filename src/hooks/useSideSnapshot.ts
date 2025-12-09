import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  const [atIso] = useState(() => (at ?? new Date()).toISOString());

  const query = useQuery({
    queryKey: ["snapshot", sideKey, atIso],
    queryFn: async () => {
      const sideId = await getSideIdByKeyNode(sideKey);
      const { data, error } = await getInstancesAtNode(sideId, atIso);

      if (error) {
        console.error("getInstancesAtNode error", error.message);
        throw new Error(error.message);
      }

      return computeSnapshotFromInstances(data ?? [], atIso);
    },
    refetchInterval: 20_000, // 20s auto-refresh
  });

  return {
    snapshot: (query.data as SideSnapshot | undefined) ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    isLoading: query.isLoading,
  };
}
