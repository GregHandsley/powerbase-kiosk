# Notification & Email System Design

## Overview

A comprehensive notification and email system that handles:

- Configurable "notification window" (not a hard cutoff)
- 12-hour hard restriction before sessions
- Email notifications for last-minute changes
- Regular reminder emails for pending actions
- User preferences and admin configuration

---

## 1. Terminology & Concepts

### Notification Window (Not "Cutoff")

- **Definition**: A configurable day/time before the week starts (e.g., Thursday 23:59)
- **Purpose**: When bookings/changes happen after this window, notify relevant people via email
- **Behavior**: Bookings are still allowed, but emails are sent to alert staff
- **Configurable**: Admins can set day of week, time, and disable entirely

### Hard Restriction (12-Hour Rule)

- **Definition**: Cannot create/edit bookings within 12 hours of session start
- **Purpose**: Prevent last-minute chaos
- **Behavior**: Hard block (booking cannot be created/edited)
- **Configurable**: Can be enabled/disabled by admin

### Email Types

1. **Last-Minute Alert Emails** (within notification window)
   - Sent to: Configurable recipients (roles/users)
   - Triggered: When booking created/edited after notification window
   - Recipient: User who made the change also gets notified

2. **Regular Reminder Emails** (outside notification window)
   - Sent to: Configurable recipients (roles/users)
   - Triggered: Scheduled at configurable times (e.g., daily at 9am, weekly on Monday)
   - Content: Summary of pending bookings, changes needing review, etc.
   - Friendly tone, actionable items

3. **User Confirmation Emails**
   - Sent to: User who made last-minute booking/change
   - Triggered: When they create/edit after notification window
   - Content: Confirmation that their booking was received, but changes may be needed

---

## 2. Database Schema

### `notification_settings` Table

Stores admin-configured notification and email settings.

```sql
CREATE TABLE notification_settings (
  id BIGSERIAL PRIMARY KEY,

  -- Notification Window Configuration
  notification_window_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_window_day_of_week INTEGER NOT NULL DEFAULT 4, -- 0=Sunday, 4=Thursday
  notification_window_time TIME NOT NULL DEFAULT '23:59:00',

  -- Hard Restriction (12-hour rule)
  hard_restriction_enabled BOOLEAN NOT NULL DEFAULT true,
  hard_restriction_hours INTEGER NOT NULL DEFAULT 12,

  -- Last-Minute Alert Recipients
  last_minute_alert_roles TEXT[], -- ['admin', 'bookings_team']
  last_minute_alert_user_ids UUID[], -- Specific user IDs

  -- Regular Reminder Configuration
  reminder_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_schedule JSONB NOT NULL DEFAULT '[]', -- Array of {time: "09:00", days: [1,2,3,4,5], type: "daily"|"weekly"}
  reminder_recipient_roles TEXT[],
  reminder_recipient_user_ids UUID[],

  -- Email Service Configuration
  email_service_provider TEXT NOT NULL DEFAULT 'resend', -- 'resend', 'sendgrid', 'ses'
  email_from_name TEXT NOT NULL DEFAULT 'Powerbase Kiosk',
  email_from_address TEXT NOT NULL,
  email_api_key_encrypted TEXT, -- Encrypted API key

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);
```

### `email_notification_preferences` Table

User-level email preferences.

```sql
CREATE TABLE email_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Last-minute alerts
  receive_last_minute_alerts BOOLEAN NOT NULL DEFAULT true,

  -- Regular reminders
  receive_reminder_emails BOOLEAN NOT NULL DEFAULT true,
  reminder_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'never'

  -- User confirmation emails
  receive_confirmation_emails BOOLEAN NOT NULL DEFAULT true,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `email_queue` Table

Queue for sending emails (if using async processing).

```sql
CREATE TABLE email_queue (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL, -- 'last_minute_alert', 'reminder', 'confirmation'
  template_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `email_sent_log` Table

Log of sent emails for tracking and debugging.

```sql
CREATE TABLE email_sent_log (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
```

---

## 3. Email Service Recommendation

### Recommended: **Resend**

- **Why**: Modern, developer-friendly, great DX, React email templates
- **Package**: `resend` (npm)
- **React Email**: `@react-email/components` for template building
- **Features**:
  - Simple API
  - Built-in React email support
  - Good free tier
  - Great documentation

### Alternative: **SendGrid**

- **Why**: More established, higher volume limits
- **Package**: `@sendgrid/mail`
- **Features**: More enterprise features, higher cost

### Implementation Approach

- Use Supabase Edge Functions for email sending (serverless, secure API key storage)
- Or use a Node.js backend service if you have one
- Store API keys encrypted in database or use Supabase secrets

---

## 4. Admin Settings UI Structure

### New Admin Page: "Notification Settings"

Located at `/admin?view=notification-settings`

**Sections:**

#### 4.1 Notification Window Configuration

- Toggle: Enable/disable notification window
- Day selector: Day of week (Monday-Sunday)
- Time picker: Time of day (HH:mm)
- Description: "Bookings/changes after this time will trigger email alerts"

#### 4.2 Hard Restriction (12-Hour Rule)

- Toggle: Enable/disable hard restriction
- Hours input: Number of hours before session (default 12)
- Description: "Prevent bookings within X hours of session start"

#### 4.3 Last-Minute Alert Recipients

- Role checkboxes: Admin, Bookings Team, Coaches
- User selector: Multi-select dropdown of all users
- Preview: Shows who will receive alerts

#### 4.4 Regular Reminder Emails

- Toggle: Enable/disable reminder emails
- Schedule builder:
  - Frequency: Daily, Weekly, Custom
  - Time: HH:mm
  - Days of week (for weekly/custom)
- Recipient roles: Checkboxes
- Recipient users: Multi-select
- Preview: Shows schedule summary

#### 4.5 Email Service Configuration

- Provider selector: Resend, SendGrid, AWS SES
- From name: Text input
- From email: Email input
- API key: Secure input (masked, with "Update" button)
- Test email: Button to send test email

---

## 5. Email Templates

### Template 1: Last-Minute Booking Alert

**To**: Staff (bookings team, admins)
**Subject**: "Last-Minute Booking: [Booking Title]"
**Content**:

- Booking details (title, date, time, side, racks, athletes)
- Who made the booking
- When it was created
- Link to view/edit booking
- Note: "This booking was created after the notification window"

### Template 2: Last-Minute Change Alert

**To**: Staff (bookings team, admins)
**Subject**: "Last-Minute Change: [Booking Title]"
**Content**:

- What changed (racks, capacity, time, etc.)
- Who made the change
- When it was changed
- Link to view booking
- Note: "This change was made after the notification window"

### Template 3: User Confirmation (Last-Minute)

**To**: User who made booking/change
**Subject**: "Your Booking Has Been Received"
**Content**:

- Confirmation of booking details
- Note that it was made after notification window
- May require adjustments
- Link to view booking

### Template 4: Daily Reminder

**To**: Bookings team, admins
**Subject**: "Daily Booking Summary - [Date]"
**Content**:

- Pending bookings count
- Last-minute changes count
- Urgent items (bookings in next 7 days)
- Link to bookings team dashboard

### Template 5: Weekly Reminder

**To**: Bookings team, admins
**Subject**: "Weekly Booking Summary - Week of [Date]"
**Content**:

- Summary of week's bookings
- Pending items
- Last-minute changes
- Link to bookings team dashboard

---

## 6. Scheduled Email Jobs

### Implementation Options

#### Option A: Supabase Edge Functions + Cron Triggers

- Use Supabase Edge Functions for email sending
- Use Supabase Cron (pg_cron) to trigger functions
- Pros: Serverless, no additional infrastructure
- Cons: Limited to PostgreSQL cron capabilities

#### Option A: Inngest (Recommended)

- **Package**: `inngest` (npm)
- **Why**: Modern, reliable, great DX, built for scheduled jobs
- **Features**:
  - Scheduled functions
  - Retry logic
  - Event-driven
  - Great dashboard
- **Setup**: Edge function or separate service

#### Option B: Trigger.dev

- Similar to Inngest, good alternative

#### Option C: Node-cron + Background Service

- Traditional approach
- Requires running background service
- More control, more infrastructure

### Recommended: Inngest

- Modern, reliable
- Great for scheduled emails
- Easy to set up with Supabase

---

## 7. User Flow Examples

### Flow 1: Booking Created After Notification Window

1. User creates booking on Friday (notification window was Thursday 23:59)
2. System checks: Is it after notification window? Yes
3. System checks: Is hard restriction enabled? Check if within 12 hours
4. If within 12 hours: Block booking, show error
5. If after 12 hours: Allow booking, but:
   - Mark as `last_minute_change = true`
   - Create task for bookings team
   - Send email to configured recipients (bookings team, admins)
   - Send confirmation email to user

### Flow 2: Regular Reminder Email

1. Cron job triggers at configured time (e.g., 9am daily)
2. System checks: Are reminder emails enabled? Yes
3. System queries: Pending bookings, last-minute changes
4. System gets recipient list from settings
5. System generates email content
6. System sends emails via Resend
7. System logs sent emails

---

## 8. Implementation Plan

### Phase 1: Database & Settings UI

1. Create database tables (migrations)
2. Create admin settings page UI
3. Create settings management hooks
4. Add to admin sidebar

### Phase 2: Email Service Integration

1. Set up Resend account
2. Create Supabase Edge Function for email sending
3. Create email templates (React Email)
4. Test email sending

### Phase 3: Notification Window Logic

1. Update cutoff utilities to use settings
2. Update booking creation/editing to check notification window
3. Implement hard restriction (12-hour rule)
4. Add email sending on last-minute changes

### Phase 4: Scheduled Reminders

1. Set up Inngest or cron system
2. Create reminder email generation logic
3. Create scheduled jobs
4. Test reminder emails

### Phase 5: User Preferences

1. Create user preferences UI
2. Integrate preferences into email sending logic
3. Add preferences to user profile

---

## 9. File Structure

```
src/
  components/
    admin/
      notification-settings/
        NotificationSettings.tsx (main page)
        NotificationWindowSection.tsx
        HardRestrictionSection.tsx
        LastMinuteRecipientsSection.tsx
        ReminderScheduleSection.tsx
        EmailServiceConfigSection.tsx
  hooks/
    useNotificationSettings.ts
    useEmailPreferences.ts
    useEmailQueue.ts
  services/
    email/
      emailService.ts (Resend client)
      templates/
        LastMinuteAlert.tsx
        UserConfirmation.tsx
        DailyReminder.tsx
        WeeklyReminder.tsx
      sendEmail.ts
  utils/
    notificationWindow.ts (updated cutoff logic)
supabase/
  functions/
    send-email/
      index.ts (Edge function for email sending)
    send-reminders/
      index.ts (Edge function for scheduled reminders)
```

---

## 10. Questions to Resolve

1. **Email Service**: Confirm Resend or prefer SendGrid?
2. **Scheduled Jobs**: Prefer Inngest, Trigger.dev, or Supabase Cron?
3. **Email Templates**: Use React Email or plain HTML?
4. **User Preferences**: Should users be able to opt out of all emails, or just some types?
5. **Reminder Frequency**: What are the default reminder times? (e.g., daily at 9am, weekly on Monday)
6. **Email Volume**: Expected volume? (affects service choice)

---

## Next Steps

1. Review and approve this design
2. Choose email service and scheduled job system
3. Create database migrations
4. Build admin settings UI
5. Implement email service integration
6. Add scheduled reminder jobs
