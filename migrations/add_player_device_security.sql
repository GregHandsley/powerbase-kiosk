-- Sprint 5.1: Security hardening - token revoke, device lockout
-- Adds revoked_at, failed_auth_count, lockout_until to player_devices

ALTER TABLE public.player_devices
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS failed_auth_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lockout_until timestamptz NULL;

-- Index for quick lookup of non-revoked devices
CREATE INDEX IF NOT EXISTS player_devices_revoked_idx
  ON public.player_devices (device_id)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN public.player_devices.revoked_at IS 'When set, device token is invalid. Heartbeats and commands are rejected immediately.';
COMMENT ON COLUMN public.player_devices.failed_auth_count IS 'Consecutive failed auth attempts. Reset on success.';
COMMENT ON COLUMN public.player_devices.lockout_until IS 'Device locked out until this time due to suspicious behavior.';
