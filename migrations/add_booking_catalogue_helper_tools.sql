-- Migration: Booking catalogue helper tools
-- Adds SQL helpers for:
-- 1) Suggesting squad matches from legacy free-text booking titles
-- 2) Mapping legacy titles to a target squad in batches

CREATE OR REPLACE FUNCTION public.suggest_booking_catalogue_matches(
  p_org_id bigint,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  legacy_title text,
  booking_count bigint,
  suggested_squad_id bigint,
  suggested_squad_name text,
  match_type text
)
LANGUAGE sql
STABLE
AS $$
  WITH legacy AS (
    SELECT
      b.title AS legacy_title,
      COUNT(*)::bigint AS booking_count
    FROM public.bookings b
    WHERE b.organization_id = p_org_id
      AND (b.booking_type = 'one_off' OR b.booking_type IS NULL)
      AND b.title IS NOT NULL
      AND length(trim(b.title)) > 0
    GROUP BY b.title
    ORDER BY COUNT(*) DESC, b.title
    LIMIT GREATEST(p_limit, 1)
  )
  SELECT
    l.legacy_title,
    l.booking_count,
    s.id AS suggested_squad_id,
    s.name AS suggested_squad_name,
    CASE
      WHEN lower(l.legacy_title) = lower(s.name) THEN 'exact'
      WHEN strpos(lower(l.legacy_title), lower(s.name)) > 0 THEN 'contains'
      WHEN strpos(lower(s.name), lower(l.legacy_title)) > 0 THEN 'contained_by'
      ELSE 'none'
    END AS match_type
  FROM legacy l
  LEFT JOIN LATERAL (
    SELECT sq.id, sq.name
    FROM public.booking_squads sq
    WHERE sq.organization_id = p_org_id
      AND sq.active = true
    ORDER BY
      CASE
        WHEN lower(l.legacy_title) = lower(sq.name) THEN 0
        WHEN strpos(lower(l.legacy_title), lower(sq.name)) > 0 THEN 1
        WHEN strpos(lower(sq.name), lower(l.legacy_title)) > 0 THEN 2
        ELSE 9
      END,
      length(sq.name),
      sq.name
    LIMIT 1
  ) s ON true;
$$;

COMMENT ON FUNCTION public.suggest_booking_catalogue_matches(bigint, integer) IS
  'Suggests likely squad matches for legacy free-text booking titles.';

CREATE OR REPLACE FUNCTION public.map_legacy_titles_to_squad(
  p_org_id bigint,
  p_squad_id bigint,
  p_titles text[],
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_squad record;
  v_row record;
  v_updated integer := 0;
BEGIN
  IF p_titles IS NULL OR cardinality(p_titles) = 0 THEN
    RETURN 0;
  END IF;

  SELECT
    sq.id,
    sq.name,
    sq.organization_id
  INTO v_squad
  FROM public.booking_squads sq
  WHERE sq.id = p_squad_id
    AND sq.organization_id = p_org_id
  LIMIT 1;

  IF v_squad.id IS NULL THEN
    RAISE EXCEPTION 'Target squad % not found in organization %', p_squad_id, p_org_id;
  END IF;

  FOR v_row IN
    SELECT
      b.id,
      b.site_id,
      b.title,
      b.booking_type,
      b.squad_id,
      b.display_name
    FROM public.bookings b
    WHERE b.organization_id = p_org_id
      AND b.title = ANY(p_titles)
      AND (b.squad_id IS DISTINCT FROM p_squad_id OR b.booking_type IS DISTINCT FROM 'catalogue')
  LOOP
    UPDATE public.bookings b
    SET
      squad_id = p_squad_id,
      booking_type = 'catalogue',
      display_name = COALESCE(b.display_name, b.title),
      title = v_squad.name,
      last_edited_at = now(),
      last_edited_by = COALESCE(p_actor_user_id, b.last_edited_by)
    WHERE b.id = v_row.id;

    INSERT INTO public.activity_log (
      organization_id,
      site_id,
      event_type,
      entity_type,
      entity_id,
      actor_user_id,
      old_value,
      new_value,
      metadata
    )
    VALUES (
      p_org_id,
      v_row.site_id,
      'booking.updated',
      'booking',
      NULL,
      p_actor_user_id,
      jsonb_build_object(
        'title', v_row.title,
        'booking_type', v_row.booking_type,
        'squad_id', v_row.squad_id,
        'display_name', v_row.display_name
      ),
      jsonb_build_object(
        'title', v_squad.name,
        'booking_type', 'catalogue',
        'squad_id', p_squad_id,
        'display_name', COALESCE(v_row.display_name, v_row.title)
      ),
      jsonb_build_object(
        'booking_id', v_row.id,
        'action', 'legacy_title_mapping',
        'mapped_to_squad_id', p_squad_id,
        'mapped_to_squad_name', v_squad.name
      )
    );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

ALTER FUNCTION public.map_legacy_titles_to_squad(bigint, bigint, text[], uuid)
  SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.map_legacy_titles_to_squad(bigint, bigint, text[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.map_legacy_titles_to_squad(bigint, bigint, text[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.map_legacy_titles_to_squad(bigint, bigint, text[], uuid) FROM authenticated;

COMMENT ON FUNCTION public.map_legacy_titles_to_squad(bigint, bigint, text[], uuid) IS
  'Batch maps legacy free-text booking titles to a squad and logs booking.updated activity with old/new values.';
