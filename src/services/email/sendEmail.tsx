// Utility functions for sending different types of emails
import { render } from '@react-email/render';
import { sendEmail } from './emailService';
import { LastMinuteAlert } from './templates/LastMinuteAlert';
import { UserConfirmation } from './templates/UserConfirmation';
import { DailyReminder } from './templates/DailyReminder';
import { format } from 'date-fns';

export interface LastMinuteAlertData {
  bookingTitle: string;
  bookingDate: string;
  bookingTime: string;
  side: string;
  racks: string;
  athletes: number;
  createdBy: string;
  createdAt: string;
  bookingLink: string;
  isEdit?: boolean;
  changes?: string;
}

export interface UserConfirmationData {
  toEmail: string;
  bookingTitle: string;
  bookingDate: string;
  bookingTime: string;
  side: string;
  racks: string;
  athletes: number;
  bookingLink: string;
  isEdit?: boolean;
}

export interface DailyReminderData {
  date: string;
  pendingCount: number;
  lastMinuteCount: number;
  urgentCount: number;
  dashboardLink: string;
}

/**
 * Sends a last-minute alert email to staff
 */
export async function sendLastMinuteAlert(
  data: LastMinuteAlertData,
  recipients: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await render(
      <LastMinuteAlert
        bookingTitle={data.bookingTitle}
        bookingDate={data.bookingDate}
        bookingTime={data.bookingTime}
        side={data.side}
        racks={data.racks}
        athletes={data.athletes}
        createdBy={data.createdBy}
        createdAt={data.createdAt}
        bookingLink={data.bookingLink}
        isEdit={data.isEdit}
        changes={data.changes}
      />
    );

    const subject = data.isEdit
      ? `Last-Minute Change: ${data.bookingTitle}`
      : `Last-Minute Booking: ${data.bookingTitle}`;

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
    });

    if (!result.success) {
      console.error('Failed to send last-minute alert:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in sendLastMinuteAlert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sends a confirmation email to the user who made a last-minute booking/change
 */
export async function sendUserConfirmation(
  data: UserConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await render(
      <UserConfirmation
        bookingTitle={data.bookingTitle}
        bookingDate={data.bookingDate}
        bookingTime={data.bookingTime}
        side={data.side}
        racks={data.racks}
        athletes={data.athletes}
        bookingLink={data.bookingLink}
        isEdit={data.isEdit}
      />
    );

    const subject = data.isEdit
      ? `Booking Updated: ${data.bookingTitle}`
      : `Booking Confirmation: ${data.bookingTitle}`;

    const result = await sendEmail({
      to: data.toEmail,
      subject,
      html,
    });

    if (!result.success) {
      console.error('Failed to send user confirmation:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in sendUserConfirmation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sends a daily reminder email
 */
export async function sendDailyReminder(
  data: DailyReminderData,
  recipients: string[]
): Promise<void> {
  const html = await render(
    <DailyReminder
      date={data.date}
      pendingCount={data.pendingCount}
      lastMinuteCount={data.lastMinuteCount}
      urgentCount={data.urgentCount}
      dashboardLink={data.dashboardLink}
    />
  );

  const subject = `Daily Booking Summary - ${format(new Date(data.date), 'd MMM yyyy')}`;

  await sendEmail({
    to: recipients,
    subject,
    html,
  });
}
