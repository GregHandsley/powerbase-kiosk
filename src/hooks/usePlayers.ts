// Hook for managing players
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type Player = {
  id: number;
  organization_id: number;
  site_id: number | null;
  side_key: 'Base' | 'Power' | null;
  name: string;
  location: string | null;
  desired_url: string | null;
  desired_power_state: 'on' | 'off';
  created_at: string;
  updated_at: string;
  site_name?: string | null;
  last_seen_at?: string | null;
  online_since?: string | null;
  has_revoked_device?: boolean;
};

export type CreatePlayerParams = {
  organization_id: number;
  site_id?: number | null;
  side_key?: 'Base' | 'Power' | null;
  name: string;
  location?: string | null;
  desired_url?: string | null;
  desired_power_state?: 'on' | 'off';
};

export type UpdatePlayerParams = {
  id: number;
  name?: string;
  location?: string | null;
  desired_url?: string | null;
  desired_power_state?: 'on' | 'off';
  side_key?: 'Base' | 'Power' | null;
};

type CreatePairingCodeParams = {
  player_id: number;
  expires_in_minutes?: number;
};

export type PairingCodeResult = {
  code: string;
  expires_at: string;
};

type PlayerDevice = {
  id: number;
  device_id: string;
  last_seen_at: string | null;
  online_since: string | null;
  revoked_at: string | null;
};

type PlayerWithSite = Player & {
  site: { id: number; name: string } | { id: number; name: string }[] | null;
  devices: PlayerDevice | PlayerDevice[] | null;
};

export function usePlayers(organizationId: number | null) {
  const queryClient = useQueryClient();

  const {
    data: players = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['players', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error: playersError } = await supabase
        .from('players')
        .select(
          `
          id,
          organization_id,
          site_id,
          side_key,
          name,
          location,
          desired_url,
          desired_power_state,
          created_at,
          updated_at,
          site:sites (
            id,
            name
          ),
          devices:player_devices (
            id,
            device_id,
            last_seen_at,
            online_since,
            revoked_at
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (playersError) {
        console.error('Error fetching players:', playersError);
        return [];
      }

      return (data || []).map((row: PlayerWithSite) => {
        const site = row.site;
        const siteName = Array.isArray(site)
          ? (site[0]?.name ?? null)
          : (site?.name ?? null);
        const devices = row.devices;
        const deviceList = Array.isArray(devices)
          ? devices
          : devices
            ? [devices]
            : [];
        const hasRevokedDevice = deviceList.some((d) => d?.revoked_at != null);
        const lastSeenAt = deviceList.reduce<string | null>(
          (latest, device) => {
            if (!device?.last_seen_at) return latest;
            if (!latest) return device.last_seen_at;
            return device.last_seen_at > latest ? device.last_seen_at : latest;
          },
          null
        );
        const onlineSince = deviceList.reduce<string | null>(
          (latest, device) => {
            if (!device?.online_since) return latest;
            if (!latest) return device.online_since;
            return device.online_since > latest ? device.online_since : latest;
          },
          null
        );

        return {
          ...row,
          site_name: siteName,
          last_seen_at: lastSeenAt,
          online_since: onlineSince,
          has_revoked_device: hasRevokedDevice,
        } as Player & { has_revoked_device?: boolean };
      });
    },
    enabled: !!organizationId,
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (params: CreatePlayerParams) => {
      const { data, error: insertError } = await supabase
        .from('players')
        .insert({
          organization_id: params.organization_id,
          site_id: params.site_id ?? null,
          side_key: params.side_key ?? null,
          name: params.name.trim(),
          location: params.location?.trim() || null,
          desired_url: params.desired_url?.trim() || null,
          desired_power_state: params.desired_power_state ?? 'on',
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'Failed to create player');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', organizationId] });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async (params: UpdatePlayerParams) => {
      const updates: Record<string, unknown> = {};
      if (params.name !== undefined) updates.name = params.name.trim();
      if (params.location !== undefined) {
        updates.location = params.location?.trim() || null;
      }
      if (params.desired_url !== undefined) {
        updates.desired_url = params.desired_url?.trim() || null;
      }
      if (params.desired_power_state !== undefined) {
        updates.desired_power_state = params.desired_power_state;
      }
      if (params.side_key !== undefined) {
        updates.side_key = params.side_key;
      }

      const { error: updateError } = await supabase
        .from('players')
        .update(updates)
        .eq('id', params.id);

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update player');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', organizationId] });
    },
  });

  const createPairingCodeMutation = useMutation({
    mutationFn: async ({
      player_id,
      expires_in_minutes,
    }: CreatePairingCodeParams) => {
      const code = generatePairingCode();
      const expiresIn = expires_in_minutes ?? 15;
      const expiresAt = new Date(
        Date.now() + expiresIn * 60 * 1000
      ).toISOString();

      const { error: insertError } = await supabase
        .from('player_pairing_codes')
        .insert({
          code,
          player_id,
          expires_at: expiresAt,
        });

      if (insertError) {
        throw new Error(insertError.message || 'Failed to create pairing code');
      }

      return { code, expires_at: expiresAt } as PairingCodeResult;
    },
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: async ({
      player_id,
      rotate,
    }: {
      player_id: number;
      rotate?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        'admin-revoke-device',
        { body: { player_id, rotate } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', organizationId] });
    },
  });

  const pairDeviceMutation = useMutation({
    mutationFn: async ({
      player_id,
      code,
    }: {
      player_id: number;
      code: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        'admin-pair-device',
        { body: { player_id, code: code.trim() } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', organizationId] });
    },
  });

  return {
    players,
    isLoading,
    error,
    createPlayer: createPlayerMutation.mutateAsync,
    createPlayerLoading: createPlayerMutation.isPending,
    createPairingCode: createPairingCodeMutation.mutateAsync,
    createPairingCodeLoading: createPairingCodeMutation.isPending,
    updatePlayer: updatePlayerMutation.mutateAsync,
    updatePlayerLoading: updatePlayerMutation.isPending,
    revokeDevice: revokeDeviceMutation.mutateAsync,
    revokeDeviceLoading: revokeDeviceMutation.isPending,
    pairDevice: pairDeviceMutation.mutateAsync,
    pairDeviceLoading: pairDeviceMutation.isPending,
  };
}

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
