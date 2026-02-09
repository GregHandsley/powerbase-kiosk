<!-- # Powerbase Kiosk - Project Roadmap & Planning

## Overview

This document outlines the planned features and implementation phases for the Powerbase Kiosk application.

---

## 🎯 **Phase 1: Booking Status & User Management (Foundation)**

### 1.1 Booking Status Tracking System

**Core Requirements:**

- Status workflow: `draft` → `pending` → `processed` → `confirmed` → `completed` / `cancelled`
- Status changes trigger notifications
- Edit detection: when a booking is edited after being processed, status resets to `pending`
- Integration with bookings team workflow

**Database Changes Needed:**

- Add `status` field to `bookings` table (enum: draft, pending, processed, confirmed, completed, cancelled)
- Add `processed_by` field (bookings team user ID)
- Add `processed_at` timestamp
- Add `last_edited_at` timestamp (to detect changes after processing)
- Add `last_edited_by` field

**Key Features:**

- Status badges/indicators throughout UI
- Status filter in booking views
- Status change history/audit trail
- Visual indicators for bookings needing attention

---

### 1.2 User Bookings Dashboard

**Core Requirements:**

- Personal dashboard for each user to view their bookings
- Filter by status, date range, side (Power/Base)
- Quick actions: Edit, Delete, Extend, View Live
- Calendar view option
- List view with details

**Pages/Components Needed:**

- `/my-bookings` - Main user bookings page
- Booking card component (reusable)
- Booking detail view
- Quick action buttons
- Live view integration (see current session state)

**Features:**

- "View Live Session" button → opens Live View for that booking's time/date
- Extend booking (duplicate with new end time)
- Delete with confirmation
- Edit booking (opens booking editor)
- Status indicators
- Capacity information for their sessions

---

### 1.3 Bookings Team Integration

**Core Requirements:**

- Bookings team dashboard showing pending bookings
- Ability to mark bookings as "processed"
- Notifications for new bookings and edits
- Filter by status, date, coach, organization
- Bulk actions (process multiple at once)

**Pages/Components Needed:**

- `/bookings-team` - Bookings team dashboard
- Processing queue view
- Booking detail modal with processing action
- Notification system integration

**Workflow:**

1. Coach creates booking → Status: `pending`
2. Bookings team sees it in their queue
3. Bookings team processes → Status: `processed`, `processed_by` set
4. Coach sees status update
5. If coach edits → Status resets to `pending`, notification sent

---

### 1.4 Booking Cutoff & Last-Minute Changes

**Core Requirements:**

- Automatic cutoff: Bookings cannot be created/edited after previous Thursday of the week
- Last-minute change detection (changes after cutoff)
- Notification system for last-minute changes
- Facility manager notification
- Tracking dashboard for last-minute changes

**Implementation:**

- Cutoff calculation: Previous Thursday at 23:59:59
- Validation in booking creation/editing
- "Last-minute change" flag on bookings
- Notification queue for bookings team + facility manager
- Dashboard widget showing recent last-minute changes

**Edge Cases:**

- What if cutoff is a holiday?
- Timezone considerations
- Emergency override mechanism (admin only?)

---

## 👥 **Phase 2: User Management & Organizations**

Phase 2 – Incremental Delivery Breakdown

Think of this as “identity & access hardening”, delivered in layers.

🧱 Layer 1: Foundations (No UI, Low Risk)
2.1.1 Create organizations table

Goal: Existence of organizations without behaviour change.

Add organizations table

Add id, name, slug, settings, created_at

Seed a default organization for existing users

No RLS yet

No UI yet

✅ Outcome: Org concept exists, nothing breaks

2.1.2 Add organization ownership to core tables

Goal: Make tenant ownership explicit.

Add organization_id to:

bookings

sides (decide now; safer to scope per org)

Backfill existing rows with default org

Add indexes on organization_id

❌ No permission logic yet
❌ No isolation yet

✅ Outcome: All important data is org-aware

🔒 Layer 2: Isolation & Safety (Security First)
2.1.3 Introduce organization memberships

Goal: Prepare for multi-org users without changing UX.

Create organization_memberships table

Migrate users:

One membership per user → default org

Assign default role (eg admin)

Keep profiles unchanged otherwise

✅ Outcome: Membership model exists
✅ Future-proofed for multi-org

2.1.4 Enforce org isolation (RLS)

Goal: Prevent cross-org data leaks.

Enable RLS on:

bookings

sides

any org-scoped table

Policy:

user must have active membership in organization_id

Test with two orgs + two users

⚠️ No permissions yet — just visibility

✅ Outcome: True multi-tenant isolation

✉️ Layer 3: Invitations (Access Control Entry Point)
2.2.1 Disable public sign-up

Goal: Lock the front door.

Remove / block public registration

Only allow auth via invite acceptance

Keep login untouched

✅ Outcome: Access is now controlled

2.2.2 Invitations table (data only)

Goal: Model invite lifecycle safely.

Create invitations table

Store:

email

organization_id

role

token_hash

expires_at

accepted_at

revoked_at

No UI yet

No email yet

✅ Outcome: Secure invite model exists

2.2.3 Invitation acceptance flow

Goal: Let people actually join.

Accept invite token

Validate:

hash match

not expired

not revoked

Create:

user (if needed)

org membership

Mark invite as accepted

✅ Outcome: Controlled onboarding works end-to-end

2.2.4 Invitation management (admin)

Goal: Make invites usable.

Invite creation form

Resend (rotate token)

Revoke

Status display

✨ Nice-to-have later:

bulk invite

domain restrictions

# Insert Now (Before Continuing Layer 4): Sites + Site-Scoped Invites

Goal: Add “Sites within Organizations” without breaking existing org/invite flow.
Outcome: Invites can specify site access; accepted users only see data for assigned sites once RLS is added later.

---

## Step S1 — Add Sites (org → many sites) (DB only)

- Create `sites` table (org-owned):
  - `id`
  - `organization_id` (FK → organizations)
  - `name`
  - `slug` (unique per org)
  - `settings` (optional)
  - `created_at`
- Seed: create 1 default site per existing org (e.g., “Main Site”)
- Add indexes:
  - `(organization_id)`
  - unique `(organization_id, slug)`

✅ Outcome: Site concept exists, nothing breaks.

---

## Step S2 — Add Site Memberships (user → many sites) (DB only)

- Create `site_memberships` table:
  - `site_id` (FK → sites)
  - `user_id` (FK → auth.users)
  - `created_at`
  - PK `(site_id, user_id)`
- Backfill:
  - for every `organization_memberships` row, grant membership to that org’s default site

✅ Outcome: All existing users continue to work (they implicitly get the default site).

---

## Step S3 — Allow Invites to Assign Site Access (DB + functions)

Choose multi-site now so you don’t regret it later.

- Create `invitation_sites` table (join):
  - `invitation_id` (FK → invitations)
  - `site_id` (FK → sites)
  - PK `(invitation_id, site_id)`

- Add new function `create_invitation_with_sites(...)` (non-breaking):
  - Inputs: `email, organization_id, role, site_ids[]`
  - Creates invitation (using existing `create_invitation`)
  - Inserts rows into `invitation_sites`

✅ Outcome: You can invite a user to specific site(s) without changing existing create_invitation immediately.

---

## Step S4 — Update Invite Acceptance to Grant Site Access (DB + functions)

Update `accept_invitation(...)`:

After creating `organization_memberships`, also:

- Insert into `site_memberships` for each `invitation_sites.site_id` for that invitation
- Decide behaviour if no sites specified:
  - Recommended for now: fallback to org default site (non-breaking)
  - Later: enforce “invite must include at least one site”

✅ Outcome: On acceptance, the user is placed into the org AND assigned to the intended site(s).

---

## Step S5 — Minimal UI changes (admin invite screen)

- Update “Invite user” form:
  - Add site selector (single or multi-select)
  - Call `create_invitation_with_sites` instead of `create_invitation`
- Optional: show “Sites assigned” on invitation list

✅ Outcome: Admin can target sites when inviting.

---

## Step S6 — (Later, after RBAC or alongside RLS hardening): Site Isolation via RLS

Do NOT block current progress; implement when ready.

- Add `site_id` to site-scoped tables (recommended):
  - `sides.site_id` (required)
  - `bookings.site_id` (recommended)
  - `areas`, `racks`, `capacity_schedules`, etc. (inherit or denormalise depending on model)
- Backfill all existing data → default site
- Enable RLS policies:
  - user must have `site_memberships` for `site_id`
  - super admins bypass

✅ Outcome: True site-level isolation.

---

🧭 Layer 4: Roles & Permissions (RBAC)
2.3.1 Define roles (static)

Goal: Replace “role as a string” with intent (org-scoped roles).

Define org_role enum (admin, bookings_team, coach, facility_manager)

Ensure roles live on organization_memberships.role (not profiles)

Add profiles.is_super_admin as global flag (bypass checks later)

✅ Outcome: Roles are meaningful but inert.

2.3.2 Introduce permissions table

Goal: Create a central permission vocabulary.

Create permissions table (e.g. bookings.create, bookings.process, sites.manage)

Seed known permissions

✅ Outcome: Permission vocabulary exists (no enforcement yet).

2.3.3 Role → permission mapping

Goal: Make roles map to permissions.

Create role_permissions table

Seed defaults per role

Create helper function(s):

has_permission(user_id, organization_id, permission_key)

(optional) has_site_access(user_id, site_id) via site_memberships

✅ Outcome: RBAC logic exists (backend).

2.3.4 Enforce permissions (API first)

Goal: Secure behaviour, not UI.

Guard API routes / RPC calls using has_permission(...)

Start with high-risk actions:

invite/create/resend/revoke

booking approval / processing

overrides / last-minute changes

✅ Outcome: Real access control is live at API level.

2.3.5 Permission-based UI rendering

Goal: Improve UX (not security).

Hide buttons/pages based on permissions

Add “access denied” states

Optional: “Why can’t I see this?” tooltip/help

✅ Outcome: UI matches permissions model.

🧱 Site Isolation via RLS (S6) — Correct Place & Gated

You’ve already done S1–S5 (Sites, Site Memberships, Invitation Sites, Accept Invite grants site access, minimal UI).
S6 is enforcement, so place it after RBAC exists and you’re ready to harden RLS without breaking writes.

S6a — Prepare site scoping (schema + backfill only)

When: After 2.3.3 or 2.3.4 (RBAC exists, but before enforcement).
Goal: Make DB “site-aware” without breaking the app.

Add site_id columns to site-scoped tables:

sides.site_id (required)

bookings.site_id (recommended)

areas.site_id, racks.site_id, capacity_schedules.site_id (denormalize for RLS performance)

Backfill per organization’s default site, not “first site globally”:

derive from organization_id where possible (e.g. sides.organization_id → sites.organization_id AND slug='main-site')

bookings/areas/racks derive from side’s site

Add indexes on site_id

🚫 Do not:

set NOT NULL

enable RLS

add policies yet

✅ Outcome: App still works, DB is ready for isolation.

S6b — Enforce site isolation (RLS + constraints)

When: After 2.3.4 (API permission enforcement is stable) or alongside broader RLS hardening.
Goal: Flip the enforcement switches safely.

Prereq checklist (must be true before running):

All write paths supply site_id (create/edit booking, create side, etc.)

Your “current site” concept exists (selected site in UI / persisted preference / route param)

You can handle multi-site users (site selector, or default site fallback)

Then:

Set site_id NOT NULL on site-scoped tables

Enable RLS on site-scoped tables

Add policies:

user must have site_memberships for row’s site_id

profiles.is_super_admin bypass

Ensure policies include proper WITH CHECK for inserts/updates (not just USING)

✅ Outcome: True site-level isolation is live.



👤 Layer 5: User Profile & Compliance
2.4.1 Profile basics

/profile page

Edit name / display info

View org memberships + roles

View site memberships (sites user can access)

2.4.2 Password & email changes

Password change (requires current password)

Email change with verification

Re-auth required

2.4.3 Account deletion (GDPR-safe)

Soft delete account

Anonymize PII

Preserve bookings + audit history -->

📜 Layer 6: Audit & Governance
2.5.1 Audit log (minimal)

Create audit_log table

Log:

invites created/accepted/revoked

role changes

permission changes

site membership changes

org/site settings changes

2.5.2 Admin audit UI

View audit events per org

Filter by user/action

Optional export + retention

<!-- ✅ Cursor build steps — Layer 6: Audit & Governance (extended incl. 2.5.2)
Step 0 — Confirm admin access rule (single source of truth)

Identify the existing rule/function that determines: “user is admin/owner of org”

If it doesn’t exist, create:

DB function public.is_org_admin(p_org_id uuid) returns boolean

OR a server-side helper requireOrgAdmin(orgId)

Use this consistently for:

audit log reads (RLS and API)

audit UI page access -->

<!-- 2.5.1 Audit log (minimal)
Step 1 — Create audit_log table + indexes (migration)

Create migration to add public.audit_log with:

id uuid primary key default gen_random_uuid()

created_at timestamptz not null default now()

organization_id uuid not null references organizations(id) on delete cascade

site_id uuid null references sites(id) on delete set null

event_type text not null

entity_type text not null

entity_id uuid null

actor_user_id uuid null references auth.users(id) on delete set null

subject_user_id uuid null references auth.users(id) on delete set null

old_value jsonb null

new_value jsonb null

metadata jsonb not null default '{}'::jsonb

Indexes:

(organization_id, created_at desc)

(organization_id, event_type, created_at desc)

(organization_id, actor_user_id, created_at desc)

optional: (site_id, created_at desc) if you filter by site frequently -->

<!-- Step 2 — RLS policies for audit_log (read admin-only, append-only)

Enable RLS on public.audit_log

Policies:

SELECT: allow if public.is_org_admin(organization_id) is true

INSERT: deny to anon/authenticated clients (service role only)

UPDATE/DELETE: no policies (effectively blocked) -->

<!-- Step 3 — Create DB function: public.log_audit_event(...)

Create a SQL function to insert a row:

Signature:

log_audit_event(p_organization_id, p_site_id, p_event_type, p_entity_type, p_entity_id, p_actor_user_id, p_subject_user_id, p_old_value, p_new_value, p_metadata)

Behavior:

Insert to audit_log

Coalesce metadata to {} when null

Set created_at = now()

Safety:

App must treat this as “best effort” (fail-open) -->

<!-- Step 4 — Add backend helper wrapper logAuditEvent

Add a server-side helper (single place):

Calls DB log_audit_event

try/catch so core operations never fail due to audit

Normalises event naming and ensures metadata is JSON-safe -->

<!-- Step 5 — Integrate audit logging into existing operations

For each mutation, call logAuditEvent AFTER success:

Invitations

created → invitation.created

accepted → invitation.accepted

revoked → invitation.revoked

deleted → invitation.deleted

Org membership role changes

membership.role.changed with:

subject_user_id

old_value/new_value only for { role }

Role permissions

added → role_permission.added

removed → role_permission.removed

metadata: { role_id, permission_key }

Site membership

added → site_membership.added

removed → site_membership.removed

Settings

org.settings.updated / site.settings.updated

Store only changed keys (diff), not full settings blobs -->

<!-- 2.5.2 Admin audit UI (required in this version)
Step 6 — Build an audit log read API (server-only)

Create endpoint or server function getAuditLogs:

Input

organizationId (required)

Optional filters:

actorUserId

eventType

dateFrom

dateTo

siteId

search (simple string match on metadata or entity_id)

Pagination:

limit (default 50)

cursor-based pagination preferred:

cursorCreatedAt, cursorId (stable ordering)

Output

rows

nextCursor (or null)

Authorization

Enforce org admin/owner:

server-side guard (requireOrgAdmin(orgId))

Query audit_log scoped to org_id only

Implementation details

Sort: created_at desc, id desc

Where clauses for provided filters

Return minimal shape needed for UI -->

<!-- Step 7 — Admin UI page: “Audit” -->

<!-- Create an admin-only route, e.g.:

/org/[orgId]/admin/audit

UI requirements

Page guards:

If not org admin, redirect or show “Not authorised”

Page layout:

Header: “Audit Log”

Subtext: “Privileged actions and governance changes”

Filters UI

Event type dropdown (populated from a known list)

Actor user selector (searchable dropdown if you have users list; otherwise text input of user id/email)

Date range (from/to)

Site selector (if org has sites)

“Apply” + “Clear filters”

Audit table columns

Time (relative + tooltip exact timestamp)

Event (event_type)

Actor (display name/email if available)

Subject (optional)

Entity (entity_type + short entity_id)

Site (optional)

Row details drawer / expand

Show:

old_value (pretty JSON)

new_value (pretty JSON)

metadata (pretty JSON)

For settings changes: render key-level diff (only changed keys)

Pagination

“Load more” button using cursor

Keep filters applied when paginating

Step 8 — Export (CSV) endpoint + UI button

Add server endpoint:

exportAuditLogsCsv(organizationId, filters...)

Behavior

Same auth checks as read API

Same filters

Hard cap export size (e.g., 10k rows) to prevent abuse

Stream CSV or generate file response

CSV columns:

created_at, event_type, actor_user_id, subject_user_id, entity_type, entity_id, site_id, old_value, new_value, metadata

In UI:

“Export CSV” button exports current filtered view

Step 9 — Retention policy (MVP implementation)

Policy

Add config:

default retention = 90 days

optionally per-org override stored in organizations.settings.auditRetentionDays

Deletion job
Implement one of these (pick what you already use):

Option A (Supabase scheduled cron / edge function):

Daily job deletes audit_log rows older than retention for each org

Option B (DB scheduled job if available):

A scheduled SQL function runs nightly

Minimum viable

Start with a global retention (90 days)

Later: upgrade to per-org override

Step 10 — Tests + validation

Add tests:

Org admin can fetch audit logs for their org

Non-admin cannot fetch audit logs

Export endpoint blocks non-admin

Filters work:

event type filter

actor filter

date range

“Role change” logs old/new role correctly

Performance checks:

Ensure main query uses (organization_id, created_at desc) index

Ensure export uses streaming or capped query


🔔 Layer 7: Nice-to-Haves (Only When Ready)

Org branding (logo, colours)


Notification preferences

Bulk invite CSV

Domain-restricted invites

Admin impersonation (fully audited)

Feature flags per org

“Explain access” UI

---

## 🔔 **Phase 3: Notifications & Communication**

### 3.1 Notification System

**Core Requirements:**

- In-app notifications
- Email notifications (optional)
- Notification preferences per user
- Notification history
- Unread count

**Database Changes:**

- Add `notifications` table:
  - `id`, `user_id`, `type`, `title`, `message`, `link`, `read_at`, `created_at`
- Add `notification_preferences` table:
  - `user_id`, `type`, `in_app`, `email`, `enabled`

**Notification Types:**

- `booking:created`
- `booking:processed`
- `booking:edited`
- `booking:cancelled`
- `last_minute_change`
- `system:update`
- `feedback:response`

**Features:**

- Notification bell/indicator in header
- Notification dropdown/list
- Mark as read/unread
- Notification preferences page
- Email digest option (daily/weekly)

---






### 3.2 Feedback System

**Core Requirements:**

- Simple feedback form
- Slack integration (send to your Slack)
- Feedback categorization
- Optional: feedback response tracking

**Implementation:**

- Feedback button/modal (subtle, not overpowering)
- Feedback form: category, message, optional screenshot
- Slack webhook integration
- Store feedback in database (optional, for tracking)

**Categories:**

- Bug report
- Feature request
- UI/UX improvement
- General feedback

**Features:**

- "Send Feedback" button in header (subtle)
- Feedback modal
- Slack notification with context (user, page, etc.)
- Thank you message after submission



🏃 Sprint Plan — Phase 3.2: Feedback System (Slack-Only, Minimal)
🎯 Sprint Goal

Enable users to submit quick feedback that is delivered directly to Slack with enough context for immediate action — no database, no admin UI, no workflow overhead.

🟢 Sprint 1 — Core Feedback Loop (MVP)

Outcome:
A user can submit feedback from the app and it appears in Slack with context.

Tasks

Create Slack webhook

Create an incoming webhook in Slack

Store webhook URL securely (env variable)

Create backend endpoint

POST /feedback

Validate:

category (enum)

message (required, max length)

Extract context automatically:

user id / name (if logged in)

org / site (if applicable)

page URL

environment

Send formatted message to Slack

Return success response

Build feedback modal

Fields:

Category (select)

Message (textarea)

Simple submit button

Disable submit while sending

Add subtle trigger

“Send feedback” button in header or footer

Low visual weight (icon or text link)

Success UX

Toast or inline message:

“Thanks — we’ve got it 👍”

Auto-close modal










🟡 Sprint 2 — Polish & Guardrails

Outcome:
Feedback is safe, spam-resistant, and readable in Slack.

Tasks

Improve Slack message formatting

Clear title: [Bug], [Feature], etc.

Structured layout:

Category

User

Org / site

Page

Message

Rate limiting

Limit submissions per user/IP (e.g. 5 per hour)

Return friendly error message if exceeded

Validation hardening

Trim message input

Reject empty or whitespace-only submissions

Enforce max length

Anonymous handling

If no user session:

Label as “Anonymous”

Still include page + environment

🔵 Sprint 3 — Optional Context Enhancements (Only if Easy)

Outcome:
More useful context in Slack without increasing UI complexity.

Optional Tasks (pick only what’s trivial)

Add environment tag (Prod / Staging)

Add browser / device info (user agent summary)

Include timestamp in Slack message

Masked email or user identifier (if useful)

❌ No screenshots
❌ No database
❌ No status tracking

---

### 3.3 System Updates/Announcements

**Core Requirements:**

- Admin-controlled announcements
- Targeted announcements (by role, organization)
- Dismissible notifications
- Update history

**Database Changes:**

- Add `announcements` table:
  - `id`, `title`, `message`, `type` (info/warning/success), `target_roles`, `target_organizations`, `published_at`, `expires_at`, `created_by`
- Add `announcement_dismissals` table:
  - `user_id`, `announcement_id`, `dismissed_at`

**Features:**

- Announcement banner (top of page, dismissible)
- Announcement center/history
- Rich text support (markdown?)
- Scheduled announcements
- Expiration handling


Sprints (copy/paste)
🟢 Sprint 1 — DB + basic modal

Create announcements table (id, title, message, published_at, active)

Add profiles.announcements_last_seen_at

Create endpoint GET /announcements/new:

if last_seen_at is null → return latest X announcements (or just latest 1)

else return announcements where published_at > last_seen_at

Create endpoint POST /announcements/ack:

set announcements_last_seen_at = now()

Add login modal:

show only if API returns new announcements

“Got it” button calls ack

🟡 Sprint 2 — Admin publishing (minimal)

Simple admin-only page or script to create announcement:

title + message

publish (sets published_at)

toggle active (optional)

🔵 Sprint 3 — Polish (optional)

Allow basic formatting (markdown-lite)

Add “Do not show again” isn’t needed (ack covers it)

Add expiry if you want (expires_at) -->

---

## 📺 **Phase 4: Kiosk Enhancements**

### 4.1 Kiosk Capacity Display

**Core Requirements:**

- Show capacity information on kiosk displays (like Live View)
- Display on both Power and Base kiosks
- Current capacity usage vs limit
- Visual indicator (green/yellow/red)

**Implementation:**

- Add capacity display component to kiosk header
- Fetch capacity data for current time slot
- Show: "X / Y athletes" with color coding
- Update in real-time (every 20 seconds)

---

### 4.2 Kiosk Visual Improvements

**Core Requirements:**

- Improve overall kiosk appearance
- Better typography and spacing
- Enhanced floorplan visualization
- Better color contrast
- Responsive design for different screen sizes

**Areas to Improve:**

- Header design
- Floorplan rendering
- Booking block styling
- Time indicator styling
- Overall polish and professional appearance

---

## 📋 **Implementation Priority & Phases**

### **Phase 1: Foundation (Weeks 1-4)**

1. Booking status tracking system
2. User bookings dashboard
3. Bookings team integration
4. Booking cutoff & last-minute changes

**Why First:** Core functionality that enables everything else

---

### **Phase 2: User Management (Weeks 5-8)**

1. Organization management
2. Invitation-only system
3. Role-based permissions
4. User profile management

**Why Second:** Security and access control foundation

---

### **Phase 3: Communication (Weeks 9-10)**

1. Notification system
2. Feedback system
3. System updates/announcements

**Why Third:** Enhances user experience and engagement

---

### **Phase 4: Polish (Weeks 11-12)**

1. Kiosk capacity display
2. Kiosk visual improvements

**Why Last:** Visual polish and final touches

---

## 🔧 **Technical Considerations**

### Database Migrations Needed

- Booking status fields
- Organizations table
- Invitations table
- Permissions tables
- Notifications table
- Announcements table
- Various junction tables

### New Pages/Routes Needed

- `/my-bookings` - User bookings dashboard
- `/bookings-team` - Bookings team dashboard
- `/profile` - User profile
- `/admin/users` - User management
- `/admin/organizations` - Organization management
- `/admin/permissions` - Permission management
- `/admin/invitations` - Invitation management
- `/notifications` - Notification center
- `/announcements` - Announcement center

### External Integrations

- Slack webhook (for feedback)
- Email service (for invitations, notifications)
- Optional: Email service provider (SendGrid, Mailgun, etc.)

### Security Considerations

- Invitation token security (cryptographically secure)
- Permission checks on all routes
- Organization data isolation
- Password reset flow
- Account deletion cleanup
- GDPR compliance for user data

---

## 📊 **Industry Standards to Follow**

### User Management

- **Password Policy:** Minimum 8 characters, complexity requirements, expiration (optional)
- **Account Lockout:** After X failed login attempts
- **Password Reset:** Secure token-based flow
- **Account Deletion:** Soft delete with data retention period
- **Audit Trail:** Track user actions (who did what, when)

### Booking Workflow

- **Status Lifecycle:** Clear state machine
- **Cutoff Rules:** Industry standard is 2-7 days before
- **Last-Minute Changes:** Require approval/escalation
- **Notifications:** Don't spam, but ensure important updates are seen

### Multi-Tenancy

- **Data Isolation:** Strict separation between organizations
- **Organization Admin:** Each org has admin(s)
- **Super Admin:** Platform-level administration

### Permissions

- **Principle of Least Privilege:** Default to minimal permissions
- **Role Inheritance:** Permissions cascade from roles
- **Override Capability:** Admins can grant specific permissions
- **Audit Logging:** Track permission changes

---

## 🎨 **UX Considerations**

### Feedback System

- **Subtle Placement:** Small button in header, not intrusive
- **Context-Aware:** Pre-fill current page/feature
- **Quick Submission:** Minimal fields, optional details

### Notifications

- **Non-Intrusive:** Bell icon with badge, not popups
- **Grouping:** Group similar notifications
- **Dismissible:** Easy to clear
- **Preferences:** User controls what they see

### Announcements

- **Banner Style:** Top of page, dismissible
- **Priority Levels:** Info, warning, urgent
- **Expiration:** Auto-hide after date
- **History:** View past announcements

---

## 🔄 **Workflow Examples**

### Booking Creation Flow

1. Coach creates booking → Status: `pending`
2. Notification sent to bookings team
3. Bookings team processes → Status: `processed`
4. Notification sent to coach
5. Coach can view in "My Bookings" dashboard

### Booking Edit Flow (Before Cutoff)

1. Coach edits booking → Status remains or updates appropriately
2. If already processed → Status: `pending` (needs reprocessing)
3. Notification sent to bookings team

### Booking Edit Flow (After Cutoff - Last Minute)

1. Coach attempts edit → Validation blocks or warns
2. If override allowed → Status: `pending`, `last_minute_change: true`
3. Notifications sent to:
   - Bookings team (high priority)
   - Facility manager (high priority)
4. Appears in "Last Minute Changes" dashboard

### Invitation Flow

1. Super admin creates invitation
2. Email sent with secure token
3. User clicks link → Accepts invitation
4. Sets password → Account created
5. Can now log in

---

## 📝 **Questions to Resolve**

1. **Cutoff Timing:**
   - Previous Thursday at what time? (midnight? end of business day?)
   - Timezone considerations?
   - Holiday handling?

2. **Last-Minute Changes:**
   - Who can override? (admins only? facility managers?)
   - Approval workflow or just notification?
   - Automatic vs manual processing?

3. **Organizations:**
   - Are sides (Power/Base) global or per-organization?
   - Can users belong to multiple organizations?
   - Organization-level capacity settings?

4. **Permissions Granularity:**
   - How detailed? (per-feature or per-action?)
   - Can coaches edit other coaches' bookings?
   - Can bookings team see all organizations or just assigned ones?

5. **Notifications:**
   - Email required or optional?
   - Real-time or batched?
   - Notification retention period?

6. **Feedback:**
   - Store in database or just Slack?
   - Response mechanism?
   - Public roadmap from feedback?

---

## 🚀 **Quick Wins (Can Start Immediately)**

1. **Kiosk Capacity Display** - Relatively simple, high impact
2. **User Bookings Dashboard** - Reuses existing components
3. **Feedback System** - Simple Slack integration
4. **Booking Status Field** - Add to database, display in UI

---

## 📈 **Success Metrics**

- Booking processing time
- Last-minute change frequency
- User engagement (dashboard usage)
- Feedback submission rate
- Notification engagement
- System adoption rate

---

**This is a living document - update as priorities and requirements evolve.**
