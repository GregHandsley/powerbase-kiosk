// Edge Function: Send Email Digest
// Scheduled job to send daily/weekly email digests of unread notifications
//
// Usage: Can be called manually or scheduled via Supabase cron
// Security: Requires service role key (should not be called from client)
// Frequency: Should be called daily for daily digests, weekly for weekly digests

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-expect-error: Remote Resend import is resolved at runtime/deploy time
import { Resend } from 'https://esm.sh/resend@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotificationDigestItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface UserDigestData {
  user_id: string;
  email: string;
  full_name: string;
  digest_frequency: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests (for scheduled jobs)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const emailFromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') ?? '';
    const emailFromName = Deno.env.get('EMAIL_FROM_NAME') ?? 'Powerbase Kiosk';
    const appUrl = Deno.env.get('APP_URL') ?? '';

    if (
      !supabaseUrl ||
      !supabaseServiceKey ||
      !resendApiKey ||
      !emailFromAddress
    ) {
      return new Response(
        JSON.stringify({
          error: 'Missing required configuration',
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
            hasResendKey: !!resendApiKey,
            hasEmailFrom: !!emailFromAddress,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body to get frequency (defaults to 'daily')
    let requestBody: { frequency?: 'daily' | 'weekly' } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // Empty body is fine, will use default
    }

    const frequency = requestBody.frequency || 'daily';
    const sinceDate = new Date();
    if (frequency === 'daily') {
      sinceDate.setDate(sinceDate.getDate() - 1);
    } else {
      sinceDate.setDate(sinceDate.getDate() - 7);
    }

    // Use service role client to bypass RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get users who should receive digests
    const { data: users, error: usersError } = await supabaseClient.rpc(
      'get_users_for_email_digest',
      { p_frequency: frequency }
    );

    if (usersError) {
      console.error('Error fetching users for digest:', usersError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch users for digest',
          details: usersError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `No users found with ${frequency} email digest enabled`,
          emailsSent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[send-email-digest] Processing ${users.length} users for ${frequency} digest`
    );

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    const fromField = emailFromName
      ? `${emailFromName} <${emailFromAddress}>`
      : emailFromAddress;

    let emailsSent = 0;
    let emailsFailed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each user
    for (const user of users as UserDigestData[]) {
      try {
        // Get unread notifications for this user
        const { data: notifications, error: notifError } =
          await supabaseClient.rpc('get_unread_notifications_for_digest', {
            p_user_id: user.user_id,
            p_since: sinceDate.toISOString(),
          });

        if (notifError) {
          console.error(
            `Error fetching notifications for user ${user.user_id}:`,
            notifError
          );
          errors.push({
            userId: user.user_id,
            error: `Failed to fetch notifications: ${notifError.message}`,
          });
          continue;
        }

        // Skip if no notifications
        if (!notifications || notifications.length === 0) {
          console.log(
            `Skipping user ${user.user_id} - no unread notifications`
          );
          continue;
        }

        // Format date range for email
        const dateRange =
          frequency === 'daily' ? 'the past 24 hours' : 'the past week';

        // Generate email HTML using React Email template
        // Note: We'll need to import the template component
        // For now, we'll create a simple HTML version
        const emailHtml = generateDigestEmailHtml(
          user.full_name,
          frequency,
          notifications as NotificationDigestItem[],
          appUrl,
          dateRange
        );

        const frequencyText = frequency === 'daily' ? 'Daily' : 'Weekly';
        const subject = `${frequencyText} Notification Digest - ${notifications.length} unread notification${notifications.length > 1 ? 's' : ''}`;

        // Send email
        const { error: emailError } = await resend.emails.send({
          from: fromField,
          to: user.email,
          subject,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Error sending email to ${user.email}:`, emailError);
          errors.push({
            userId: user.user_id,
            error: `Failed to send email: ${emailError.message}`,
          });
          emailsFailed++;
          continue;
        }

        // Mark notifications as read
        const notificationIds = notifications.map((n) => n.id);
        const { error: markReadError } = await supabaseClient.rpc(
          'mark_notifications_read_for_digest',
          {
            p_user_id: user.user_id,
            p_notification_ids: notificationIds,
          }
        );

        if (markReadError) {
          console.warn(
            `Failed to mark notifications as read for user ${user.user_id}:`,
            markReadError
          );
          // Don't fail the whole operation, just log it
        }

        emailsSent++;
        console.log(`Sent ${frequency} digest to ${user.email}`);
      } catch (error) {
        console.error(`Error processing user ${user.user_id}:`, error);
        errors.push({
          userId: user.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        frequency,
        usersProcessed: users.length,
        emailsSent,
        emailsFailed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-email-digest function:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to generate email HTML
// In production, you'd use the React Email template, but for Edge Functions
// we'll use a simpler HTML approach
function generateDigestEmailHtml(
  userName: string,
  frequency: 'daily' | 'weekly',
  notifications: NotificationDigestItem[],
  appUrl: string,
  dateRange: string
): string {
  const frequencyText = frequency === 'daily' ? 'Daily' : 'Weekly';
  const dashboardLink = appUrl || 'https://app.powerbase.com';

  function formatNotificationType(type: string): string {
    const typeMap: Record<string, string> = {
      'booking:created': 'Booking Created',
      'booking:processed': 'Booking Processed',
      'booking:edited': 'Booking Edited',
      'booking:cancelled': 'Booking Cancelled',
      last_minute_change: 'Last Minute Change',
      'system:update': 'System Update',
      'feedback:response': 'Feedback Response',
    };
    return typeMap[type] || type;
  }

  function getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'booking:created': '📅',
      'booking:processed': '✅',
      'booking:edited': '✏️',
      'booking:cancelled': '❌',
      last_minute_change: '⚠️',
      'system:update': 'ℹ️',
      'feedback:response': '💬',
    };
    return iconMap[type] || '🔔';
  }

  const notificationsHtml = notifications
    .map(
      (n) => `
      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 16px; margin-bottom: 12px;">
        <div style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          ${getNotificationIcon(n.type)} ${formatNotificationType(n.type)}
        </div>
        <div style="color: #f1f5f9; font-size: 16px; font-weight: 600; margin-bottom: 8px;">
          ${n.title}
        </div>
        ${
          n.message
            ? `<div style="color: #cbd5e1; font-size: 14px; line-height: 20px; margin-bottom: 8px;">${n.message}</div>`
            : ''
        }
        ${
          n.link
            ? `<a href="${n.link}" style="color: #818cf8; text-decoration: underline; font-size: 14px;">View details →</a>`
            : ''
        }
        <div style="color: #64748b; font-size: 12px; margin-top: 8px;">
          ${new Date(n.created_at).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px;">
        <div style="background-color: #1e293b; margin: 0 auto; padding: 40px 20px; max-width: 600px; border-radius: 8px;">
          <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin-bottom: 24px;">
            ${frequencyText} Notification Digest
          </h1>
          
          <p style="color: #cbd5e1; font-size: 16px; line-height: 24px; margin-bottom: 16px;">
            Hi ${userName},
          </p>

          <p style="color: #cbd5e1; font-size: 16px; line-height: 24px; margin-bottom: 16px;">
            You have <strong>${notifications.length}</strong> unread notification${notifications.length > 1 ? 's' : ''} from ${dateRange}:
          </p>

          <div style="margin-top: 24px; margin-bottom: 24px;">
            ${notificationsHtml}
          </div>

          <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
            <a href="${dashboardLink}" style="background-color: #4f46e5; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">
              View All Notifications
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 18px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
            You're receiving this email because you have email digest enabled in your notification preferences.
            You can change these settings in your <a href="${dashboardLink}/profile" style="color: #818cf8; text-decoration: underline;">profile settings</a>.
          </p>
        </div>
      </body>
    </html>
  `;
}
