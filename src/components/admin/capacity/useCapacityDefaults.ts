import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

/**
 * Hook to fetch default capacity and platforms for a period type and side
 */
export function useCapacityDefaults(
  isOpen: boolean,
  periodType: PeriodType,
  sideId: number | null,
  existingPlatforms?: number[] | null
) {
  const [defaultCapacity, setDefaultCapacity] = useState<number | null>(null);
  const [defaultPlatforms, setDefaultPlatforms] = useState<number[]>([]);
  const [loadingDefault, setLoadingDefault] = useState(false);

  useEffect(() => {
    if (isOpen && periodType && sideId) {
      setLoadingDefault(true);
      supabase
        .from('period_type_capacity_defaults')
        .select('default_capacity, platforms')
        .eq('period_type', periodType)
        .eq('side_id', sideId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching default capacity:', error);
            setDefaultCapacity(null);
            setDefaultPlatforms([]);
          } else {
            // For "Closed" period type, always set capacity to 0 and platforms to empty array
            if (periodType === 'Closed') {
              setDefaultCapacity(0);
              setDefaultPlatforms([]);
            } else {
              setDefaultCapacity(data?.default_capacity ?? null);
              // If no existing platforms set and we have defaults, use them
              if (
                !existingPlatforms &&
                data?.platforms &&
                Array.isArray(data.platforms)
              ) {
                setDefaultPlatforms(data.platforms as number[]);
              } else {
                setDefaultPlatforms(existingPlatforms || []);
              }
            }
          }
          setLoadingDefault(false);
        });
    }
  }, [isOpen, periodType, sideId, existingPlatforms]);

  return {
    defaultCapacity,
    defaultPlatforms,
    loadingDefault,
  };
}
