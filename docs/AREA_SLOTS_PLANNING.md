# Area slots & wayfinding – sprint plan

**Goal:** Squads have one master booking (time + headcount for Legend). Practitioners allocate **area slots** (area + start/end) within that booking so the facility can see who uses which space when. Wayfinding shows which areas are in use at the current time so users know where to go and conflict is reduced.

**Existing behaviour (unchanged):**

- Master booking: `bookings` + `booking_instances` (start, end, racks[], areas[]). Legend receives time + headcount only.
- `areas` table exists: `id`, `side_id`, `key`, `name`. `useAreas()` fetches areas. Booking form already has an `areas` field (array of area keys) for the whole instance.
- `computeSnapshot` already has `nextUseByArea` and `currentInstances[].areas` (instance-level areas, no time slots).
- Floorplans (Base/Power) have visual area shapes (DUMBBELL AREA, CABLES, MACHINES, etc.) but no `areaKey` or “in use” state yet.

**New behaviour:**

- **Area slots:** Each slot = one area + start time + end time, within the instance’s window. Slots can overlap (e.g. resistance + racks at same time).
- **Wayfinding:** At current time T, areas that have an active slot (slot.start ≤ T < slot.end) are shown as “in use” on the map.
- **Legend:** Still receives only time + headcount; no area detail sent.

---

## Sprint 1: Area reference & map keys (foundation)

**Goal:** Single source of truth for area keys that match both the DB `areas` table and the wayfinding map. Floorplan areas can be identified by key for later highlighting.

**Scope:**

- Define a small set of **area keys** used across the app (e.g. `dumbbell`, `cables`, `fixed_machines`, `functional`, `weight_lifting`, `track`, `bike_met_con`). Ensure `areas` table has rows for these (or add a seed migration) with `key` and `name` matching what you want on the map.
- In the **Base** floorplan (`FloorShell.tsx` and any place that draws area rects/labels), give each drawn area a stable **area key** (e.g. data attribute, or pass a list of `{ key, label, … }` so the same key is used in the SVG and in data).
- In the **Power** floorplan, do the same for any bookable areas (if Power has areas beyond racks; if not, skip or add one “platforms” area if useful).
- No change yet to booking form or snapshot logic; this sprint is only “areas exist and map regions have keys.”

**Acceptance criteria:**

- [ ] `areas` table contains rows with `key` values that match the floorplan (e.g. `dumbbell`, `cables`, …).
- [ ] Base floorplan (and Power if applicable) has a clear mapping: this rect/group = this `areaKey`. Either via a constant list of `{ areaKey, label, position }` used to render, or by adding `data-area-key` (or similar) to the relevant SVG elements for future use.
- [ ] No regression to existing booking or wayfinding behaviour.

**Technical notes:**

- `src/components/admin/booking/useAreas.ts` already fetches from `areas`; ensure `key` is used consistently.
- Base floorplan: `FloorShell.tsx` has DUMBBELL AREA, CABLES, MACHINES, FUNCTIONAL, WEIGHT LIFTING, TRACK, BIKE/MET CON. Map those to keys (e.g. snake_case) and use one shared list so keys are consistent.

---

## Sprint 2: Area slots data model

**Goal:** Store time-bound area usage per instance: “area X from 09:00 to 09:30” within a booking instance.

**Scope:**

- **New table:** `booking_instance_area_slots` with columns: `id`, `booking_instance_id` (FK to `booking_instances`), `area_key` (text; references `areas.key` or equivalent), `start` (timestamptz or time-with-date), `end` (same). Add indexes for `(booking_instance_id)` and for “active at time” queries (e.g. `(area_key, start, end)` or a check that `start < end`).
- **Types:** Add `AreaSlot` (or `BookingInstanceAreaSlot`) in `src/types/db.ts` and any instance type that needs to carry slots. Optionally add a small type for “slot active at time T” for snapshot.
- **API / data layer:** When loading instances for a side/date, also load their area slots (e.g. join or separate query). When saving/updating a booking (creating/updating instances), support writing area slots (create/update/delete by instance). Expose slots in the same place you currently expose instance `areas`/`racks` so the UI can show and edit them.
- **Backward compatibility:** Existing `booking_instances.areas` can remain as-is for now (e.g. “simple” list for legacy or summary). Snapshot in Sprint 4 will use **area slots** to compute “active areas at T”; you can later derive a “summary” areas list from slots if needed.

**Acceptance criteria:**

- [ ] Migration creates `booking_instance_area_slots` with correct FKs and constraints.
- [ ] Types and API allow: get slots for instance(s); create/update/delete slots when saving a booking.
- [ ] No change yet to UI or wayfinding; only data model and read/write of slots.

**Technical notes:**

- `booking_instances` has `start`/`end`; slot `start`/`end` must be within that window (enforce in app or with a check constraint).
- Prefer `area_key` (string) to avoid joins if `areas` is small and stable; otherwise `area_id` FK is fine.

---

## Sprint 3: UI – add/edit area slots on a booking

**Goal:** Practitioners can add, edit, and remove area slots when creating or editing a booking. Simple list form first (no timeline drag-and-drop).

**Scope:**

- When editing a booking (or creating one with instances), after or alongside the existing “platforms” selection, show **Area slots**.
- **List form:** “Add slot” → pick **area** (dropdown from `areas` for the booking’s side), **start time**, **end time** (within the instance’s start/end). Display as a list of rows: “Area name – 09:00–09:30 [Edit] [Remove]”. Allow multiple slots; overlapping (same or different areas) is allowed.
- **Validation:** Slot start < end; slot must be within the instance window; show errors inline.
- **Persistence:** On save, write `booking_instance_area_slots` (create/update/delete) so the stored slots match the form state. When loading a booking for edit, load instance(s) and their slots and populate the form.
- **Optional:** If the booking has multiple instances (e.g. recurring), decide whether slots are per-instance (each instance has its own slots) or “template” slots that apply to all. Recommend **per-instance** for maximum flexibility; template can be a later enhancement.

**Acceptance criteria:**

- [ ] User can add multiple area slots per instance (area + start + end).
- [ ] User can edit and remove slots. Validation keeps slots within instance window.
- [ ] Saving the booking persists area slots; reloading the booking shows them.
- [ ] No change yet to wayfinding display; only creation/editing of slots.

**Technical notes:**

- Reuse `useAreas()` for the area dropdown; filter by `side_id` if instances are side-specific.
- Reuse existing time/date context (instance start/end) for validation and time pickers.

---

## Sprint 4: Snapshot & wayfinding – “active areas” on the map

**Goal:** At current time T, compute which areas have an active slot (slot.start ≤ T < slot.end) and show those areas as “in use” on the wayfinding map.

**Scope:**

- **Snapshot / compute:** Extend snapshot logic (or add a helper) that, given instances + their area slots and a time `at`, returns **active area keys at that time**. Option A: extend `computeSnapshotFromInstances` to accept instances with slots and set e.g. `activeAreaKeysAtTime: Set<string>` or `inUseAreaKeys: string[]` on the snapshot. Option B: keep snapshot as-is and in the wayfinding page (or in a selector) compute “active areas at now” from instances + slots and pass that into the map. Prefer one place (e.g. snapshot or a single selector) so wayfinding just consumes “which areas are in use.”
- **Data loading:** Ensure wayfinding (and any other consumer) loads instances **with their area slots** for the current day (or for the time window you need). If instances are currently loaded without slots, add slots to the query or fetch.
- **FloorplanMap / Base (and Power):** Accept a prop such as `inUseAreaKeys?: Set<string>` (or `string[]`). For each drawn area that has an `areaKey`, if that key is in `inUseAreaKeys`, render it as “in use” (e.g. different fill/opacity, or a small “In use” label). Reuse the same pattern as `highlightedRacks` for platforms.
- **Wayfinding page:** Pass `inUseAreaKeys` (derived from snapshot/selector at current time) into `FloorplanMap`. KioskWayfinding and KioskWayfindingStatic both use `FloorplanMap`; both should pass the same derived set.

**Acceptance criteria:**

- [ ] At time T, areas that have at least one active slot (start ≤ T < end) are computed correctly.
- [ ] Wayfinding map highlights (or clearly marks) those areas as in use. Other areas remain in default state.
- [ ] When time passes, the map updates (e.g. when kiosk time or real time advances) so “in use” reflects the current moment.
- [ ] Platforms/racks continue to work as today (highlighted by platform status rotation, etc.).

**Technical notes:**

- `SideSnapshot` could get e.g. `inUseAreaKeys: string[]` computed when building the snapshot, or you compute it in the wayfinding page from `currentInstances` + their slots. If snapshot is built in one place (e.g. `computeSnapshotFromInstances`), extending it with slots and `inUseAreaKeys` keeps logic central.
- Base floorplan: use the area keys from Sprint 1; when rendering each area rect/group, check `inUseAreaKeys.has(areaKey)` and apply “in use” styling.

---

## Sprint 5 (optional): Timeline view & conflict warning

**Goal:** Nicer UX for building slots (timeline) and optional conflict warning when two bookings use the same area at the same time.

**Scope:**

- **Timeline view:** In the booking form, optionally show a simple timeline (horizontal axis = time within the instance window). Each area slot appears as a block (area label + time range). “Add slot” adds a block; drag to resize or move (optional). This can be a second view alongside the list from Sprint 3.
- **Conflict warning:** When saving or when changing slots, check if any slot overlaps (same area_key, overlapping start/end) with another instance’s slot for the same side/date. If overlap exists, show a warning (e.g. “This area is already in use by another booking at this time”). Do not block save unless product decision is to block; initially **warn only**.
- **Out of scope for v1:** Hard capacity limits per area (e.g. “only 2 squads in Functional at once”); can be added later.

**Acceptance criteria:**

- [ ] Timeline view (if implemented) shows slots as blocks and allows add/edit/remove consistent with list form.
- [ ] Overlap check runs on the same area and overlapping time; warning is shown when conflict exists.
- [ ] No regression to wayfinding or slot persistence.

---

## Copy-paste prompts for AI (per sprint)

Use these as the **main instruction** when handing a sprint to an AI; paste the relevant sprint section above as context.

**Sprint 1:**  
“Implement Sprint 1 from docs/AREA_SLOTS_PLANNING.md: area reference and map keys. Ensure the `areas` table has rows with keys that match the Base (and Power) floorplan. Add a stable areaKey mapping to each drawn area in the floorplan so we can later highlight by key. Do not change booking form or snapshot logic.”

**Sprint 2:**  
“Implement Sprint 2 from docs/AREA_SLOTS_PLANNING.md: area slots data model. Add table `booking_instance_area_slots`, types, and API to read/write slots with instances. Do not change UI or wayfinding yet.”

**Sprint 3:**  
“Implement Sprint 3 from docs/AREA_SLOTS_PLANNING.md: UI to add/edit area slots on a booking. List form: add slot (area + start + end), edit, remove; validate within instance window; persist on save. Load slots when loading booking for edit.”

**Sprint 4:**  
“Implement Sprint 4 from docs/AREA_SLOTS_PLANNING.md: snapshot and wayfinding. Compute active area keys at current time from instances and their area slots. Pass inUseAreaKeys to FloorplanMap and highlight those areas on the Base (and Power) floorplan. Ensure wayfinding pages pass the derived set.”

**Sprint 5:**  
“Implement Sprint 5 (optional) from docs/AREA_SLOTS_PLANNING.md: timeline view for area slots and conflict warning when two bookings use the same area at the same time. Warn only; do not block save.”

---

## File reference (existing codebase)

- **Types:** `src/types/db.ts` (BookingInstanceRow, BookingRow), `src/types/snapshot.ts` (SideSnapshot, ActiveInstance, nextUseByArea).
- **Snapshot:** `src/nodes/logic/computeSnapshot.ts` (computeSnapshotFromInstances).
- **Areas:** `src/components/admin/booking/useAreas.ts` (useAreas), `areas` table.
- **Instances load:** `src/nodes/data/instancesNodes.ts`; booking form / submission in `src/components/admin/booking/useBookingSubmission.ts`, `BookingFormPanel`, `BookingFormFields`.
- **Floorplans:** `src/components/floorplans/base/BaseFloorplan.tsx`, `src/components/floorplans/base/FloorShell.tsx`, `src/components/floorplans/power/PowerFloorplan.tsx`; `src/components/kiosk/ZoneC_FloorplanMap.tsx`.
- **Wayfinding:** `src/pages/KioskWayfinding.tsx`, `src/pages/KioskWayfindingStatic.tsx`; both use `FloorplanMap` with `snapshot` and `visiblePlatformIds`.
