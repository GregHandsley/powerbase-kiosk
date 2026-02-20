import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { logActivity } from '../../../lib/activityLogger';
import { useAuth } from '../../../context/AuthContext';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { ConfirmationDialog } from '../../shared/ConfirmationDialog';
import { useNotificationSettings } from '../../../hooks/useNotificationSettings';
import { getRoleDisplayName, type OrgRole } from '../../../types/auth';
import { getDeterministicBookingColor } from '../../../utils/bookingColor';

type BookingFamily = {
  id: number;
  organization_id: number;
  name: string;
  active: boolean;
};

type BookingSquad = {
  id: number;
  family_id: number;
  organization_id: number;
  name: string;
  logo_url: string | null;
  active: boolean;
};

type BookingReportRow = {
  booking_type: 'catalogue' | 'one_off' | null;
  created_at: string;
  title: string | null;
  display_name: string | null;
  squad_id: number | null;
  squad: {
    id: number;
    name: string;
    family_id: number;
    family?: { id: number; name: string } | null;
  } | null;
};

const ONE_OFF_ROLE_OPTIONS: OrgRole[] = [
  'admin',
  'bookings_team',
  'coach',
  'snc_coach',
  'fitness_coach',
  'customer_service_assistant',
  'duty_manager',
  'facility_manager',
];

async function logCatalogueEvent(params: {
  organizationId: number;
  eventType: string;
  actorUserId: string | null;
  metadata?: Record<string, unknown>;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}) {
  await logActivity({
    organizationId: params.organizationId,
    eventType: params.eventType,
    entityType: 'booking_catalogue',
    actorUserId: params.actorUserId,
    metadata: params.metadata ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
  });
}

export function BookingCatalogueManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = usePrimaryOrganizationId();
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newSquadName, setNewSquadName] = useState('');
  const [newSquadFamilyId, setNewSquadFamilyId] = useState<number | null>(null);
  const [uploadingSquadId, setUploadingSquadId] = useState<number | null>(null);
  const [uploadTargetSquad, setUploadTargetSquad] =
    useState<BookingSquad | null>(null);
  const [openFamilyMenuId, setOpenFamilyMenuId] = useState<number | null>(null);
  const [openSquadMenuId, setOpenSquadMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'family'; item: BookingFamily }
    | { kind: 'squad'; item: BookingSquad }
    | null
  >(null);
  const [logoRemovalTarget, setLogoRemovalTarget] =
    useState<BookingSquad | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOneOffRoles, setSelectedOneOffRoles] = useState<OrgRole[]>([]);
  const [policiesDirty, setPoliciesDirty] = useState(false);
  const {
    settings: notificationSettings,
    updateSettings,
    isUpdating,
  } = useNotificationSettings();

  const { data: families = [], isLoading: loadingFamilies } = useQuery({
    queryKey: ['booking-catalogue-families', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as BookingFamily[];
      const { data, error } = await supabase
        .from('booking_families')
        .select('id, organization_id, name, active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BookingFamily[];
    },
    enabled: !!organizationId,
  });

  const { data: squads = [], isLoading: loadingSquads } = useQuery({
    queryKey: ['booking-catalogue-squads', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as BookingSquad[];
      const { data, error } = await supabase
        .from('booking_squads')
        .select('id, family_id, organization_id, name, logo_url, active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BookingSquad[];
    },
    enabled: !!organizationId,
  });

  const { data: reportingRows = [], isLoading: loadingReporting } = useQuery({
    queryKey: ['booking-catalogue-reporting', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as BookingReportRow[];
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          booking_type,
          created_at,
          title,
          display_name,
          squad_id,
          squad:booking_squads (
            id,
            name,
            family_id,
            family:booking_families (
              id,
              name
            )
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        booking_type: 'catalogue' | 'one_off' | null;
        created_at: string;
        title: string | null;
        display_name: string | null;
        squad_id: number | null;
        squad: Array<{
          id: number;
          name: string;
          family_id: number;
          family?: Array<{ id: number; name: string }> | null;
        }> | null;
      }>;

      return rows.map((row) => {
        const squad = Array.isArray(row.squad) ? row.squad[0] : null;
        const family = squad?.family?.[0] ?? null;
        return {
          booking_type: row.booking_type,
          created_at: row.created_at,
          title: row.title,
          display_name: row.display_name,
          squad_id: row.squad_id,
          squad: squad
            ? {
                id: squad.id,
                name: squad.name,
                family_id: squad.family_id,
                family,
              }
            : null,
        };
      });
    },
    enabled: !!organizationId,
  });

  const oneOffSummary = useMemo(() => {
    const total = reportingRows.length;
    const oneOff = reportingRows.filter(
      (row) => row.booking_type === 'one_off'
    );
    const oneOffRate = total > 0 ? (oneOff.length / total) * 100 : 0;
    return { total, oneOffCount: oneOff.length, oneOffRate };
  }, [reportingRows]);

  const familyUsage = useMemo(() => {
    const map = new Map<string, number>();
    reportingRows
      .filter((row) => row.booking_type === 'catalogue')
      .forEach((row) => {
        const familyName = row.squad?.family?.name ?? 'Unassigned family';
        map.set(familyName, (map.get(familyName) ?? 0) + 1);
      });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [reportingRows]);

  const squadUsage = useMemo(() => {
    const map = new Map<string, number>();
    reportingRows
      .filter((row) => row.booking_type === 'catalogue')
      .forEach((row) => {
        const squadName = row.squad?.name ?? 'Unknown squad';
        map.set(squadName, (map.get(squadName) ?? 0) + 1);
      });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reportingRows]);

  const topCustomNames = useMemo(() => {
    const map = new Map<string, number>();
    reportingRows
      .filter((row) => row.booking_type === 'one_off')
      .forEach((row) => {
        const name = (row.display_name || row.title || 'Untitled').trim();
        map.set(name, (map.get(name) ?? 0) + 1);
      });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reportingRows]);

  const monthlyOneOffRates = useMemo(() => {
    const months = new Map<string, { total: number; oneOff: number }>();
    reportingRows.forEach((row) => {
      const monthKey = row.created_at.slice(0, 7);
      const current = months.get(monthKey) ?? { total: 0, oneOff: 0 };
      current.total += 1;
      if (row.booking_type === 'one_off') current.oneOff += 1;
      months.set(monthKey, current);
    });

    return [...months.entries()]
      .map(([month, stats]) => ({
        month,
        total: stats.total,
        oneOff: stats.oneOff,
        oneOffRate: stats.total > 0 ? (stats.oneOff / stats.total) * 100 : 0,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 6);
  }, [reportingRows]);

  const squadsByFamily = useMemo(() => {
    const map = new Map<number, BookingSquad[]>();
    for (const squad of squads) {
      const existing = map.get(squad.family_id) ?? [];
      existing.push(squad);
      map.set(squad.family_id, existing);
    }
    return map;
  }, [squads]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['booking-catalogue-families', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-catalogue-squads', organizationId],
    });
    await queryClient.invalidateQueries({ queryKey: ['booking-families'] });
    await queryClient.invalidateQueries({ queryKey: ['booking-squads'] });
  };

  useEffect(() => {
    if (!notificationSettings) return;
    setSelectedOneOffRoles(
      (notificationSettings.one_off_allowed_roles as OrgRole[] | undefined) ??
        ONE_OFF_ROLE_OPTIONS
    );
    setPoliciesDirty(false);
  }, [notificationSettings]);

  const toggleOneOffRole = (role: OrgRole) => {
    setSelectedOneOffRoles((prev) => {
      const exists = prev.includes(role);
      const next = exists ? prev.filter((r) => r !== role) : [...prev, role];
      setPoliciesDirty(true);
      return next;
    });
  };

  const saveOneOffPolicies = async () => {
    if (selectedOneOffRoles.length === 0) {
      setError('Select at least one role allowed to create one-off bookings.');
      return;
    }

    try {
      await updateSettings({
        one_off_allowed_roles: selectedOneOffRoles,
      });
      setError(null);
      setPoliciesDirty(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save one-off booking policy'
      );
    }
  };

  const createFamily = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization selected');
      const name = newFamilyName.trim();
      if (!name) throw new Error('Family name is required');
      if (
        families.some(
          (family) => family.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        throw new Error('Family already exists');
      }

      const { data, error } = await supabase
        .from('booking_families')
        .insert({
          organization_id: organizationId,
          name,
          active: true,
        })
        .select('id, name')
        .single();
      if (error) throw error;

      await logCatalogueEvent({
        organizationId,
        actorUserId: user?.id ?? null,
        eventType: 'booking_catalogue.family_created',
        metadata: { family_id: data?.id, family_name: data?.name ?? name },
        newValue: { name, active: true },
      });
    },
    onSuccess: async () => {
      setNewFamilyName('');
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create family');
    },
  });

  const updateFamily = useMutation({
    mutationFn: async (payload: {
      family: BookingFamily;
      patch: Partial<Pick<BookingFamily, 'name' | 'active'>>;
    }) => {
      const { family, patch } = payload;
      const next = {
        name: patch.name ?? family.name,
        active: patch.active ?? family.active,
      };

      if (
        patch.name &&
        families.some(
          (f) =>
            f.id !== family.id &&
            f.name.toLowerCase() === patch.name!.trim().toLowerCase()
        )
      ) {
        throw new Error('Family name already exists');
      }

      const { error } = await supabase
        .from('booking_families')
        .update(next)
        .eq('id', family.id);
      if (error) throw error;

      if (organizationId) {
        await logCatalogueEvent({
          organizationId,
          actorUserId: user?.id ?? null,
          eventType: 'booking_catalogue.family_updated',
          metadata: { family_id: family.id, family_name: next.name },
          oldValue: {
            name: family.name,
            active: family.active,
          },
          newValue: next,
        });
      }
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update family');
    },
  });

  const createSquad = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization selected');
      if (!newSquadFamilyId) throw new Error('Select a family first');
      const name = newSquadName.trim();
      if (!name) throw new Error('Squad name is required');

      const familySquads = squads.filter(
        (squad) => squad.family_id === newSquadFamilyId
      );
      if (
        familySquads.some(
          (squad) => squad.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        throw new Error('Squad already exists in this family');
      }

      const { data, error } = await supabase
        .from('booking_squads')
        .insert({
          family_id: newSquadFamilyId,
          organization_id: organizationId,
          name,
          logo_url: null,
          active: true,
        })
        .select('id, name, family_id')
        .single();
      if (error) throw error;

      await logCatalogueEvent({
        organizationId,
        actorUserId: user?.id ?? null,
        eventType: 'booking_catalogue.squad_created',
        metadata: {
          squad_id: data?.id,
          squad_name: data?.name ?? name,
          family_id: data?.family_id ?? newSquadFamilyId,
        },
        newValue: {
          family_id: newSquadFamilyId,
          name,
          logo_url: null,
          active: true,
        },
      });
    },
    onSuccess: async () => {
      setNewSquadName('');
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create squad');
    },
  });

  const updateSquad = useMutation({
    mutationFn: async (payload: {
      squad: BookingSquad;
      patch: Partial<
        Pick<BookingSquad, 'name' | 'logo_url' | 'active' | 'family_id'>
      >;
    }) => {
      const { squad, patch } = payload;
      const next = {
        name: patch.name ?? squad.name,
        logo_url: patch.logo_url ?? squad.logo_url,
        active: patch.active ?? squad.active,
        family_id: patch.family_id ?? squad.family_id,
      };

      if (
        squads.some(
          (existing) =>
            existing.id !== squad.id &&
            existing.family_id === next.family_id &&
            existing.name.toLowerCase() === next.name.toLowerCase()
        )
      ) {
        throw new Error('Squad name already exists in this family');
      }

      const { error } = await supabase
        .from('booking_squads')
        .update(next)
        .eq('id', squad.id);
      if (error) throw error;

      if (organizationId) {
        await logCatalogueEvent({
          organizationId,
          actorUserId: user?.id ?? null,
          eventType: 'booking_catalogue.squad_updated',
          metadata: { squad_id: squad.id, squad_name: next.name },
          oldValue: {
            family_id: squad.family_id,
            name: squad.name,
            logo_url: squad.logo_url,
            active: squad.active,
          },
          newValue: next,
        });
      }
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update squad');
    },
  });

  const deleteFamily = useMutation({
    mutationFn: async (family: BookingFamily) => {
      const familySquads = squadsByFamily.get(family.id) ?? [];
      if (familySquads.length > 0) {
        throw new Error('Delete or move all squads in this family first.');
      }

      const { error } = await supabase
        .from('booking_families')
        .delete()
        .eq('id', family.id);
      if (error) throw error;

      if (organizationId) {
        await logCatalogueEvent({
          organizationId,
          actorUserId: user?.id ?? null,
          eventType: 'booking_catalogue.family_deleted',
          metadata: { family_id: family.id, family_name: family.name },
          oldValue: { name: family.name, active: family.active },
        });
      }
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete family');
    },
  });

  const deleteSquad = useMutation({
    mutationFn: async (squad: BookingSquad) => {
      const { count, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', squad.id);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error(
          'This squad is used by existing bookings. Mark it inactive instead of deleting.'
        );
      }

      const { error } = await supabase
        .from('booking_squads')
        .delete()
        .eq('id', squad.id);
      if (error) throw error;

      if (organizationId) {
        await logCatalogueEvent({
          organizationId,
          actorUserId: user?.id ?? null,
          eventType: 'booking_catalogue.squad_deleted',
          metadata: {
            squad_id: squad.id,
            squad_name: squad.name,
            family_id: squad.family_id,
          },
          oldValue: {
            family_id: squad.family_id,
            name: squad.name,
            logo_url: squad.logo_url,
            active: squad.active,
          },
        });
      }
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete squad');
    },
  });

  const handleOpenLogoPicker = (squad: BookingSquad) => {
    setUploadTargetSquad(squad);
    logoFileInputRef.current?.click();
  };

  const handleLogoFileChange = async (file: File | null) => {
    if (!file || !uploadTargetSquad || !organizationId) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be smaller than 5MB.');
      return;
    }

    const ext = file.name.includes('.')
      ? file.name.split('.').pop()?.toLowerCase() || 'png'
      : 'png';
    const path = `org-${organizationId}/families/${uploadTargetSquad.family_id}/squads/${uploadTargetSquad.id}/logo.${ext}`;

    setUploadingSquadId(uploadTargetSquad.id);
    try {
      const { error: uploadError } = await supabase.storage
        .from('booking-logos')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('booking-logos')
        .getPublicUrl(path);
      const publicUrl = data.publicUrl;
      await updateSquad.mutateAsync({
        squad: uploadTargetSquad,
        patch: { logo_url: publicUrl },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingSquadId(null);
      setUploadTargetSquad(null);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async (squad: BookingSquad) => {
    setUploadingSquadId(squad.id);
    try {
      const logoUrl = squad.logo_url;
      if (logoUrl && logoUrl.includes('/booking-logos/')) {
        const marker = '/object/public/booking-logos/';
        const idx = logoUrl.indexOf(marker);
        if (idx >= 0) {
          const objectPath = logoUrl.slice(idx + marker.length);
          if (objectPath) {
            await supabase.storage.from('booking-logos').remove([objectPath]);
          }
        }
      }

      await updateSquad.mutateAsync({
        squad,
        patch: { logo_url: null },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setUploadingSquadId(null);
    }
  };

  if (!organizationId) {
    return (
      <div className="text-sm text-slate-300">
        Select an organization before managing booking catalogue.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h3 className="text-base font-semibold text-slate-100">
          Booking Families
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Create/edit families and enable or disable visibility.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1">
            <label className="mb-1 block text-xs text-slate-300">
              New Family
            </label>
            <input
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
              placeholder="e.g. Performance"
            />
          </div>
          <button
            type="button"
            onClick={() => createFamily.mutate()}
            disabled={createFamily.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Add Family
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {(loadingFamilies ? [] : families).map((family) => (
            <div
              key={family.id}
              className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2 rounded-md border border-slate-700 bg-slate-950/40 p-2"
            >
              <input
                key={`family-name-${family.id}-${family.name}`}
                defaultValue={family.name}
                onBlur={(e) => {
                  const nextName = e.target.value.trim();
                  if (!nextName || nextName === family.name) return;
                  updateFamily.mutate({
                    family,
                    patch: { name: nextName },
                  });
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  updateFamily.mutate({
                    family,
                    patch: { active: !family.active },
                  })
                }
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  family.active
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {family.active ? 'Active' : 'Inactive'}
              </button>
              <div className="relative justify-self-end">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFamilyMenuId((prev) =>
                      prev === family.id ? null : family.id
                    )
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  aria-label={`Open actions for ${family.name}`}
                >
                  ⋯
                </button>
                {openFamilyMenuId === family.id && (
                  <div className="absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border border-slate-700 bg-slate-900 p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenFamilyMenuId(null);
                        setDeleteTarget({ kind: 'family', item: family });
                      }}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-900/30"
                    >
                      Delete family
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loadingFamilies && families.length === 0 && (
            <p className="text-xs text-slate-400">No families yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h3 className="text-base font-semibold text-slate-100">
          Booking Squads
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Create/edit squads, family assignment, logo upload, and active state.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select
            value={newSquadFamilyId ?? ''}
            onChange={(e) =>
              setNewSquadFamilyId(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
          >
            <option value="">Family</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
          <input
            value={newSquadName}
            onChange={(e) => setNewSquadName(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
            placeholder="Squad name"
          />
          <button
            type="button"
            onClick={() => createSquad.mutate()}
            disabled={createSquad.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2"
          >
            Add Squad
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {(loadingFamilies || loadingSquads ? [] : families).map((family) => (
            <div
              key={family.id}
              className="rounded-md border border-slate-700 bg-slate-950/30 p-3"
            >
              <div className="mb-2 text-sm font-medium text-slate-200">
                {family.name}
              </div>
              <div className="space-y-2">
                {(squadsByFamily.get(family.id) ?? []).map((squad) => (
                  <div
                    key={squad.id}
                    className="grid grid-cols-[minmax(0,1.5fr)_auto_auto_auto] items-center gap-2 rounded-md border border-slate-700 bg-slate-950/50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getDeterministicBookingColor(
                            organizationId ?? squad.organization_id,
                            'catalogue',
                            squad.id,
                            squad.name
                          ),
                          boxShadow:
                            '0 0 0 1px rgba(226, 232, 240, 0.2), 0 0 8px rgba(15, 23, 42, 0.45)',
                        }}
                        title="Schedule color for this squad"
                      />
                      <input
                        key={`squad-name-${squad.id}-${squad.name}`}
                        defaultValue={squad.name}
                        onBlur={(e) => {
                          const nextName = e.target.value.trim();
                          if (!nextName || nextName === squad.name) return;
                          updateSquad.mutate({
                            squad,
                            patch: { name: nextName },
                          });
                        }}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative h-12 w-12 shrink-0">
                        {squad.logo_url ? (
                          <>
                            <img
                              src={squad.logo_url}
                              alt={`${squad.name} logo`}
                              className="h-12 w-12 rounded border border-slate-700 object-contain bg-slate-900 p-1"
                            />
                            <button
                              type="button"
                              onClick={() => setLogoRemovalTarget(squad)}
                              className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/70 bg-red-900/90 text-[10px] font-bold leading-none text-red-100 hover:bg-red-800"
                              aria-label={`Remove ${squad.name} logo`}
                              title="Remove logo"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <div className="h-12 w-12 rounded border border-slate-700 bg-slate-900" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenLogoPicker(squad)}
                        disabled={uploadingSquadId === squad.id}
                        className="rounded-md border border-indigo-600/60 bg-indigo-900/30 px-2 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-800/40 disabled:opacity-50"
                      >
                        {uploadingSquadId === squad.id
                          ? 'Uploading...'
                          : 'Upload'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSquad.mutate({
                          squad,
                          patch: { active: !squad.active },
                        })
                      }
                      className={`justify-self-start rounded-md px-2 py-1 text-xs font-medium ${
                        squad.active
                          ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {squad.active ? 'Active' : 'Inactive'}
                    </button>
                    <div className="relative justify-self-end">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSquadMenuId((prev) =>
                            prev === squad.id ? null : squad.id
                          )
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                        aria-label={`Open actions for ${squad.name}`}
                      >
                        ⋯
                      </button>
                      {openSquadMenuId === squad.id && (
                        <div className="absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border border-slate-700 bg-slate-900 p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenSquadMenuId(null);
                              setDeleteTarget({ kind: 'squad', item: squad });
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-900/30"
                          >
                            Delete squad
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(squadsByFamily.get(family.id) ?? []).length === 0 && (
                  <p className="text-xs text-slate-500">
                    No squads in this family.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h3 className="text-base font-semibold text-slate-100">
          Reporting & Quality Controls
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Track catalogue adoption, family and squad usage, and one-off quality.
        </p>

        {loadingReporting ? (
          <p className="mt-3 text-xs text-slate-400">
            Loading reporting metrics...
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Total Bookings
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-100">
                  {oneOffSummary.total}
                </p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  One-off Bookings
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-100">
                  {oneOffSummary.oneOffCount}
                </p>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  One-off Rate
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-100">
                  {oneOffSummary.oneOffRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-slate-700 bg-slate-950/30 p-3">
                <h4 className="text-sm font-medium text-slate-200">
                  Family Usage
                </h4>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {familyUsage.slice(0, 10).map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between"
                    >
                      <span>{row.name}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {familyUsage.length === 0 && (
                    <p className="text-slate-500">No catalogue usage yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-slate-700 bg-slate-950/30 p-3">
                <h4 className="text-sm font-medium text-slate-200">
                  Top Squad Usage
                </h4>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {squadUsage.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between"
                    >
                      <span>{row.name}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {squadUsage.length === 0 && (
                    <p className="text-slate-500">No squad bookings yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-slate-700 bg-slate-950/30 p-3">
                <h4 className="text-sm font-medium text-slate-200">
                  One-off % by Month
                </h4>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {monthlyOneOffRates.map((row) => (
                    <div
                      key={row.month}
                      className="flex items-center justify-between"
                    >
                      <span>{row.month}</span>
                      <span>
                        {row.oneOff}/{row.total} ({row.oneOffRate.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                  {monthlyOneOffRates.length === 0 && (
                    <p className="text-slate-500">Not enough data yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-950/30 p-3">
                <h4 className="text-sm font-medium text-slate-200">
                  Top Custom One-off Names
                </h4>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {topCustomNames.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between"
                    >
                      <span>{row.name}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {topCustomNames.length === 0 && (
                    <p className="text-slate-500">No one-off bookings yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h3 className="text-base font-semibold text-slate-100">
          One-off Booking Policy
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Optional tightening: restrict one-off creation by role.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ONE_OFF_ROLE_OPTIONS.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/30 px-2 py-1.5 text-xs text-slate-200"
            >
              <input
                type="checkbox"
                checked={selectedOneOffRoles.includes(role)}
                onChange={() => toggleOneOffRole(role)}
                className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-900 text-indigo-500"
              />
              {getRoleDisplayName(role)}
            </label>
          ))}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => void saveOneOffPolicies()}
            disabled={!policiesDirty || isUpdating}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <ConfirmationDialog
        isOpen={!!logoRemovalTarget}
        title="Remove Logo"
        message={
          logoRemovalTarget
            ? `Remove the logo for "${logoRemovalTarget.name}"?`
            : 'Remove this logo?'
        }
        confirmLabel="Remove Logo"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={
          !!logoRemovalTarget && uploadingSquadId === logoRemovalTarget.id
        }
        lockScroll
        onConfirm={async () => {
          if (!logoRemovalTarget) return;
          await handleRemoveLogo(logoRemovalTarget);
          setLogoRemovalTarget(null);
        }}
        onCancel={() => setLogoRemovalTarget(null)}
      />
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.kind === 'family' ? 'Delete Family' : 'Delete Squad'
        }
        message={
          deleteTarget
            ? `Delete "${deleteTarget.item.name}"? This action cannot be undone.`
            : 'Delete this row?'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={deleteFamily.isPending || deleteSquad.isPending}
        lockScroll
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'family') {
            await deleteFamily.mutateAsync(deleteTarget.item);
          } else {
            await deleteSquad.mutateAsync(deleteTarget.item);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void handleLogoFileChange(file);
        }}
      />
    </div>
  );
}
