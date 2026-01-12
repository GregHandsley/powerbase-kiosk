// Utility functions for getting email recipients from notification settings
import { supabase } from '../lib/supabaseClient';
import { getUserIdsByRole } from '../hooks/useTasks';
import type { NotificationSettings } from '../hooks/useNotificationSettings';

/**
 * Gets email addresses for users by their IDs
 * Uses a database function to safely get emails from auth.users
 */
export async function getUserEmailsByIds(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    console.log('getUserEmailsByIds: No user IDs provided');
    return new Map();
  }

  try {
    console.log(
      'getUserEmailsByIds: Calling database function with',
      userIds.length,
      'user IDs'
    );
    // Call a database function to get user emails
    // This function needs to be created in Supabase
    const { data, error } = await supabase.rpc('get_user_emails', {
      user_ids: userIds,
    });

    if (error) {
      console.error('Error getting user emails from database function:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details,
      });

      // If the function doesn't exist, provide helpful error message
      if (error.code === '42883' || error.message?.includes('does not exist')) {
        console.error("⚠️ Database function 'get_user_emails' does not exist!");
        console.error(
          'Please run the migration: migrations/add_get_user_emails_function.sql'
        );
      }

      return new Map();
    }

    console.log(
      'getUserEmailsByIds: Received',
      data?.length || 0,
      'email addresses'
    );

    // Return a map of userId -> email
    const emailMap = new Map<string, string>();
    if (data && Array.isArray(data)) {
      for (const item of data) {
        if (item.user_id && item.email) {
          emailMap.set(item.user_id, item.email);
          console.log(`  - ${item.user_id}: ${item.email}`);
        }
      }
    }

    return emailMap;
  } catch (error) {
    console.error('Unexpected error getting user emails:', error);
    return new Map();
  }
}

/**
 * Gets email recipients based on notification settings
 * Returns an array of email addresses for roles and specific users
 */
export async function getEmailRecipients(
  settings: NotificationSettings
): Promise<string[]> {
  const emails: string[] = [];

  try {
    console.log('getEmailRecipients: Starting with settings:', {
      roles: settings.last_minute_alert_roles,
      userIds: settings.last_minute_alert_user_ids,
    });

    // Get user IDs for selected roles
    const roleUserIds: string[] = [];
    for (const role of settings.last_minute_alert_roles || []) {
      console.log(`getEmailRecipients: Getting user IDs for role: ${role}`);
      const userIds = await getUserIdsByRole(
        role as 'admin' | 'coach' | 'bookings_team'
      );
      console.log(
        `getEmailRecipients: Found ${userIds.length} users with role ${role}`
      );
      roleUserIds.push(...userIds);
    }

    // Combine role-based and specific user IDs
    const allUserIds = [
      ...new Set([
        ...roleUserIds,
        ...(settings.last_minute_alert_user_ids || []),
      ]),
    ];
    console.log(
      `getEmailRecipients: Total unique user IDs: ${allUserIds.length}`
    );

    if (allUserIds.length === 0) {
      console.warn(
        'getEmailRecipients: No user IDs found. Check notification settings configuration.'
      );
      return [];
    }

    // Get emails for all user IDs
    const emailMap = await getUserEmailsByIds(allUserIds);

    // Convert map to array of emails
    for (const userId of allUserIds) {
      const email = emailMap.get(userId);
      if (email) {
        emails.push(email);
      } else {
        console.warn(
          `getEmailRecipients: No email found for user ID: ${userId}`
        );
      }
    }

    console.log(
      `getEmailRecipients: Returning ${emails.length} email addresses:`,
      emails
    );
    return emails;
  } catch (error) {
    console.error('Error getting email recipients:', error);
    return [];
  }
}
