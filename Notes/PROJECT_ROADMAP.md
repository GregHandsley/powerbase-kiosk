# Powerbase Kiosk - Project Roadmap & Planning

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

🧭 Layer 4: Roles & Permissions (RBAC)
2.3.1 Define roles (static)

Goal: Replace “role as a string” with intent.

Define default roles:

super_admin

admin

bookings_team

coach

facility_manager

Assign roles per membership, not profile

No permissions yet

✅ Outcome: Roles are meaningful but inert

2.3.2 Introduce permissions table

Goal: Central permission registry.

Create permissions table

Seed known permissions (bookings.create, etc.)

No enforcement yet

✅ Outcome: Permission vocabulary exists

2.3.3 Role → permission mapping

Goal: Make roles do something.

Create role_permissions

Assign sensible defaults per role

Build helper:

hasPermission(user, org, permissionKey)

✅ Outcome: RBAC logic exists (backend)

2.3.4 Enforce permissions (API first)

Goal: Secure behaviour, not UI.

Guard API routes using permission helper

Leave UI unchanged initially

✅ Outcome: Real access control is live

2.3.5 Permission-based UI rendering

Goal: Improve UX, not security.

Hide buttons / pages based on permissions

Add “access denied” states

✨ Nice-to-have:

“Why can’t I see this?” explanation

👤 Layer 5: User Profile & Compliance
2.4.1 Profile basics

Goal: User self-service.

/profile page

Edit name / display info

View org memberships + role(s)

2.4.2 Password & email changes

Goal: Account security.

Password change (requires current password)

Email change with verification

Re-auth required

2.4.3 Account deletion (GDPR-safe)

Goal: Legal + ethical compliance.

Soft delete account

Anonymize PII

Preserve bookings + audit history

📜 Layer 6: Audit & Governance (Gold Standard)
2.5.1 Audit log (minimal)

Goal: Accountability.

Create audit_log table

Log:

invites created/accepted/revoked

role changes

permission changes

org setting changes

2.5.2 Admin audit UI

Goal: Trust & transparency.

View audit events per org

Filter by user / action

✨ Optional:

export audit logs

retention policies

🔔 Layer 7: Nice-to-Haves (Only When Ready)

Each of these is independent and can be added later:

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
