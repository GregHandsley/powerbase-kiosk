/** Human-readable label for area keys (no API dependency). */
export function areaKeyToLabel(key: string): string {
  const labels: Record<string, string> = {
    track: 'Track',
    weight_lifting: 'Weight Lifting',
    functional: 'Functional',
    machines_2: 'Machines 2',
    machines_1: 'Machines 1',
    dumbbell_1: 'Dumbbell 1',
    dumbbell_2: 'Dumbbell 2',
    bike_met_con: 'Bike / MetCon',
    dumbbell: 'Dumbbell',
    cables: 'Cables',
    fixed_machines: 'Fixed Machines',
    platforms: 'Platforms',
  };
  return (
    labels[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
