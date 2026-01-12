import { supabase } from '../../lib/supabaseClient';

export type SideKey = 'Power' | 'Base';

export interface SideRow {
  id: number;
  key: string;
  name: string;
}

export async function getSidesNode() {
  const { data, error } = await supabase
    .from('sides')
    .select('id,key,name')
    .order('id', { ascending: true });

  return {
    data: (data ?? []) as SideRow[],
    error,
  };
}

export async function getSideIdByKeyNode(sideKey: SideKey): Promise<number> {
  const { data, error } = await supabase
    .from('sides')
    .select('id,key,name')
    .eq('key', sideKey)
    .maybeSingle();

  if (error) {
    console.error('getSideIdByKeyNode error', error.message);
    throw new Error(`Failed to load side id for ${sideKey}`);
  }

  if (!data) {
    throw new Error(`Side not found for key ${sideKey}`);
  }

  return (data as SideRow).id;
}
