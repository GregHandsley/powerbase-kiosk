import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useInstancesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('booking_instances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_instances' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['snapshot'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
