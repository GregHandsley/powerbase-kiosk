# Feature Breakdown - Detailed Planning

## 🎯 **Feature 1: Booking Status Tracking**

### Database Schema
```sql
-- Add to bookings table
ALTER TABLE bookings ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN processed_by UUID REFERENCES profiles(id);
ALTER TABLE bookings ADD COLUMN processed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN last_edited_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN last_edited_by UUID REFERENCES profiles(id);

-- Status enum: 'draft', 'pending', 'processed', 'confirmed', 'completed', 'cancelled'
```

### UI Components Needed
- Status badge component (reusable)
- Status filter dropdown
- Status change modal/handler
- Status indicator in booking cards

### Business Logic
- On booking create → `status = 'pending'`
- On booking edit (if processed) → `status = 'pending'`, set `last_edited_at`
- On process → `status = 'processed'`, set `processed_by`, `processed_at`
- Status validation rules

---

## 🎯 **Feature 2: User Bookings Dashboard**

### Route: `/my-bookings`

### Components
- `MyBookingsPage.tsx` - Main page
- `BookingCard.tsx` - Reusable booking card
- `BookingFilters.tsx` - Filter by status, date, side
- `BookingActions.tsx` - Edit, Delete, Extend, View Live buttons
- `BookingCalendarView.tsx` - Optional calendar view
- `BookingListView.tsx` - List view with details

### Features
- Filter by: Status, Date Range, Side, Organization
- Sort by: Date, Status, Created Date
- Quick actions on each booking
- "View Live Session" → Opens Live View with booking's date/time pre-filled
- Extend booking → Duplicate with new end time
- Delete → Confirmation dialog
- Edit → Opens booking editor modal

### Data Fetching
- Query: `["my-bookings", userId, filters]`
- Show bookings where `created_by = userId`
- Include status, capacity info, rack assignments

---

## 🎯 **Feature 3: Bookings Team Dashboard**

### Route: `/bookings-team` (role: `bookings_team` or `admin`)

### Components
- `BookingsTeamDashboard.tsx` - Main dashboard
- `ProcessingQueue.tsx` - List of pending bookings
- `BookingDetailModal.tsx` - Full booking details
- `BulkActions.tsx` - Process multiple at once
- `LastMinuteChangesWidget.tsx` - Highlight last-minute changes

### Features
- Queue view: All `pending` bookings
- Filter by: Date, Coach, Organization, Side
- Process action: Mark as processed
- Bulk process: Select multiple, process all
- Last-minute changes: Highlighted section
- Notification badge: Count of pending items

### Workflow
1. View pending bookings
2. Click booking → See details
3. Click "Process" → Status changes, notification sent
4. Booking disappears from queue (or moves to "Processed" tab)

---

## 🎯 **Feature 4: Booking Cutoff & Last-Minute Changes**

### Cutoff Logic
```typescript
function getBookingCutoff(date: Date): Date {
  // Get the Thursday of the week containing the date
  // If date is after Thursday, use previous Thursday
  // If date is before Thursday, use the Thursday before that
  // Return Thursday at 23:59:59
}

function isAfterCutoff(date: Date): boolean {
  return new Date() > getBookingCutoff(date);
}
```

### Validation Points
- Booking creation form
- Booking edit modal
- Booking extension action
- API endpoints (server-side validation)

### Last-Minute Change Detection
- Check `last_edited_at` vs cutoff time
- Flag booking with `is_last_minute: true`
- Trigger notifications

### Notifications
- To bookings team: "Last-minute change: [Booking Title]"
- To facility manager: "Last-minute change requires attention"
- Include: Booking details, who changed it, when

---

## 🎯 **Feature 5: Organization Management**

### Database Schema
```sql
CREATE TABLE organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to profiles
ALTER TABLE profiles ADD COLUMN organization_id BIGINT REFERENCES organizations(id);

-- Add to bookings (optional - inherit from user?)
ALTER TABLE bookings ADD COLUMN organization_id BIGINT REFERENCES organizations(id);
```

### Routes
- `/admin/organizations` - List all organizations
- `/admin/organizations/new` - Create organization
- `/admin/organizations/:id` - Edit organization

### Features
- Create/edit/delete organizations
- Organization settings (JSONB for flexibility)
- Organization switcher (super admin only)
- Organization-specific branding (future)

---

## 🎯 **Feature 6: Invitation System**

### Database Schema
```sql
CREATE TABLE invitations (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  organization_id BIGINT REFERENCES organizations(id),
  role TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Routes
- `/admin/invitations` - Manage invitations
- `/invite/accept/:token` - Accept invitation page

### Flow
1. Admin creates invitation (email, role, organization)
2. System generates secure token
3. Email sent with link: `/invite/accept/{token}`
4. User clicks link → Sets password → Account created
5. Token invalidated

### Email Template
- Subject: "You've been invited to Powerbase Kiosk"
- Body: Welcome message, role, organization, acceptance link
- Expiration notice (7 days)

---

## 🎯 **Feature 7: Role-Based Permissions**

### Database Schema
```sql
CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role TEXT NOT NULL,
  permission_id BIGINT REFERENCES permissions(id),
  PRIMARY KEY (role, permission_id)
);

CREATE TABLE user_permissions (
  user_id UUID REFERENCES profiles(id),
  permission_id BIGINT REFERENCES permissions(id),
  granted BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, permission_id)
);
```

### Default Roles & Permissions

**Super Admin:**
- All permissions

**Admin:**
- `bookings:*`
- `capacity:*`
- `users:view_all`
- `users:invite` (within org)
- `notifications:*`

**Bookings Team:**
- `bookings:view_all`
- `bookings:process`
- `bookings:view_status`
- `notifications:view`

**Coach:**
- `bookings:create`
- `bookings:edit_own`
- `bookings:delete_own`
- `bookings:view_own`
- `capacity:view`

**Facility Manager:**
- `bookings:view_all`
- `capacity:view`
- `notifications:view`
- `last_minute:view`

### Permission Checks
- Hook: `usePermission(permissionKey)`
- Component: `<RequirePermission permission="bookings:create">`
- Route guard: Check permissions before rendering

---

## 🎯 **Feature 8: User Profile Management**

### Route: `/profile`

### Components
- `ProfilePage.tsx` - Main profile page
- `ProfileForm.tsx` - Edit profile info
- `PasswordChangeForm.tsx` - Change password
- `EmailChangeForm.tsx` - Change email (with verification)
- `AccountDeletion.tsx` - Delete account section

### Features
- View profile information
- Edit name, phone, etc.
- Change password (with current password verification)
- Change email (send verification email)
- Delete account (with confirmation and data cleanup)
- Activity log (optional)

### Security
- Password requirements: 8+ chars, complexity
- Email verification for changes
- Account lockout after failed attempts
- Soft delete (mark as deleted, retain for X days)

---

## 🎯 **Feature 9: Notification System**

### Database Schema
```sql
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  in_app BOOLEAN DEFAULT true,
  email BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, type)
);
```

### Components
- `NotificationBell.tsx` - Header notification icon
- `NotificationDropdown.tsx` - Notification list
- `NotificationCenter.tsx` - Full notification page
- `NotificationPreferences.tsx` - User preferences

### Notification Types
- `booking:created` - New booking created
- `booking:processed` - Booking processed by team
- `booking:edited` - Booking was edited
- `booking:cancelled` - Booking cancelled
- `last_minute_change` - Last-minute change detected
- `system:update` - System announcement
- `feedback:response` - Response to feedback

### Features
- Unread count badge
- Mark as read/unread
- Group similar notifications
- Link to relevant page
- Notification preferences
- Email digest option

---

## 🎯 **Feature 10: Feedback System**

### Implementation
- Simple form modal
- Slack webhook integration
- Optional: Store in database

### Components
- `FeedbackButton.tsx` - Subtle button in header
- `FeedbackModal.tsx` - Feedback form
- Slack webhook handler (serverless function or backend)

### Form Fields
- Category (dropdown)
- Message (textarea)
- Optional: Screenshot/attachment
- Optional: Contact info

### Slack Integration
- Webhook URL in environment
- Format: User, Page, Category, Message
- Include context (browser, timestamp, etc.)

---

## 🎯 **Feature 11: System Updates/Announcements**

### Database Schema
```sql
CREATE TABLE announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'info', 'warning', 'success', 'urgent'
  target_roles TEXT[], -- Array of roles
  target_organizations BIGINT[], -- Array of org IDs
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcement_dismissals (
  user_id UUID REFERENCES profiles(id),
  announcement_id BIGINT REFERENCES announcements(id),
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);
```

### Components
- `AnnouncementBanner.tsx` - Top banner
- `AnnouncementCenter.tsx` - View all announcements
- `AnnouncementAdmin.tsx` - Create/edit announcements

### Features
- Dismissible banner
- Targeted by role/organization
- Scheduled publishing
- Auto-expiration
- Rich text support (markdown)
- Priority levels

---

## 🎯 **Feature 12: Kiosk Capacity Display**

### Implementation
- Add capacity component to kiosk header
- Fetch capacity for current time slot
- Display: "X / Y athletes"
- Color coding: Green (<80%), Yellow (80-99%), Red (100%+)

### Components
- `KioskCapacityDisplay.tsx` - Capacity info component
- Add to `KioskHeader.tsx`

### Data
- Use existing `useLiveViewCapacity` hook
- Calculate current usage
- Show limit from capacity schedule

---

## 🎯 **Feature 13: Kiosk Visual Improvements**

### Areas to Improve
1. **Header:**
   - Better typography
   - Improved spacing
   - Capacity display integration

2. **Floorplan:**
   - Better rendering
   - Improved colors
   - Better contrast
   - Responsive sizing

3. **Booking Blocks:**
   - Better visibility
   - Improved text contrast
   - Better spacing

4. **Time Indicator:**
   - More prominent
   - Better styling
   - Smooth animations

5. **Overall:**
   - Professional polish
   - Consistent spacing
   - Better color palette
   - Responsive design

---

## 🔄 **Data Flow Examples**

### Booking Creation with Status
```
User creates booking
  ↓
Booking saved with status='pending'
  ↓
Notification created for bookings team
  ↓
Bookings team sees in queue
  ↓
Bookings team processes
  ↓
Status='processed', processed_by set
  ↓
Notification created for coach
  ↓
Coach sees status update in dashboard
```

### Last-Minute Change Flow
```
User edits booking (after cutoff)
  ↓
Validation: isAfterCutoff() = true
  ↓
Warning shown: "This is a last-minute change"
  ↓
User confirms
  ↓
Booking updated, is_last_minute=true
  ↓
Status='pending' (if was processed)
  ↓
Notifications sent:
  - Bookings team (high priority)
  - Facility manager (high priority)
  ↓
Appears in "Last Minute Changes" dashboard
```

### Invitation Flow
```
Super admin creates invitation
  ↓
Token generated (cryptographically secure)
  ↓
Invitation saved to database
  ↓
Email sent with acceptance link
  ↓
User clicks link
  ↓
Acceptance page loads
  ↓
User sets password
  ↓
Profile created, invitation marked accepted
  ↓
User can now log in
```

---

## 🛠️ **Technical Stack Additions**

### New Dependencies Needed
- Email service (optional): `@sendgrid/mail` or similar
- Slack webhook: `axios` or `fetch` (already available)
- Date utilities: `date-fns` (already have)
- Markdown renderer (for announcements): `react-markdown`

### New Hooks Needed
- `usePermission(permissionKey)` - Check user permissions
- `useNotifications()` - Fetch and manage notifications
- `useMyBookings(filters)` - Fetch user's bookings
- `useBookingStatus(bookingId)` - Track booking status

### New Context Providers
- `PermissionProvider` - Permission checking context
- `NotificationProvider` - Notification management
- `OrganizationProvider` - Current organization context

---

## 📊 **Database Migration Plan**

### Migration 1: Booking Status
- Add status fields to bookings table
- Migrate existing bookings to `status='processed'` (or appropriate)

### Migration 2: Organizations
- Create organizations table
- Create default organization
- Migrate existing users to default org

### Migration 3: Invitations
- Create invitations table
- No migration needed (new feature)

### Migration 4: Permissions
- Create permissions tables
- Seed default permissions
- Assign default role permissions

### Migration 5: Notifications
- Create notifications table
- Create notification_preferences table
- No migration needed

### Migration 6: Announcements
- Create announcements table
- Create announcement_dismissals table
- No migration needed

---

## 🎨 **UI/UX Patterns**

### Status Badges
- Color coding: Green (processed), Yellow (pending), Red (cancelled)
- Small, unobtrusive
- Tooltip on hover

### Notification Bell
- Small bell icon in header
- Red badge with count
- Dropdown on click
- "Mark all as read" option

### Feedback Button
- Small, subtle button
- Icon only (speech bubble)
- Bottom right corner or header
- Not intrusive

### Announcement Banner
- Top of page
- Dismissible (X button)
- Color coded by type
- Auto-hide after expiration

---

## 🔐 **Security Checklist**

- [ ] Invitation tokens are cryptographically secure
- [ ] Password requirements enforced
- [ ] Permission checks on all routes
- [ ] Organization data isolation
- [ ] Rate limiting on invitations
- [ ] Email verification for changes
- [ ] Account lockout after failed attempts
- [ ] Audit logging for sensitive actions
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection prevention (using parameterized queries)

---

## 📝 **Next Steps**

1. **Review this plan** - Confirm priorities and approach
2. **Clarify questions** - Resolve the questions listed in roadmap
3. **Start with Phase 1** - Begin with booking status tracking
4. **Iterate** - Build incrementally, test frequently

---

**Ready to start implementation when you are!** 🚀

