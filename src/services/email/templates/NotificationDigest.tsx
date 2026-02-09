import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface NotificationDigestItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  created_at: string;
}

interface NotificationDigestProps {
  userName: string;
  frequency: 'daily' | 'weekly';
  notifications: NotificationDigestItem[];
  dashboardLink: string;
  dateRange: string;
}

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

export function NotificationDigest({
  userName,
  frequency,
  notifications,
  dashboardLink,
  dateRange,
}: NotificationDigestProps) {
  const frequencyText = frequency === 'daily' ? 'Daily' : 'Weekly';
  const hasNotifications = notifications.length > 0;

  return (
    <Html>
      <Head />
      <Preview>
        {hasNotifications
          ? `You have ${notifications.length} unread notification${notifications.length > 1 ? 's' : ''}`
          : 'No new notifications'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{frequencyText} Notification Digest</Heading>

          <Text style={text}>Hi {userName},</Text>

          {hasNotifications ? (
            <>
              <Text style={text}>
                You have <strong>{notifications.length}</strong> unread
                notification{notifications.length > 1 ? 's' : ''} from{' '}
                {dateRange}:
              </Text>

              <Section style={notificationsContainer}>
                {notifications.map((notification) => (
                  <Section key={notification.id} style={notificationItem}>
                    <Text style={notificationHeader}>
                      {getNotificationIcon(notification.type)}{' '}
                      {formatNotificationType(notification.type)}
                    </Text>
                    <Text style={notificationTitle}>{notification.title}</Text>
                    {notification.message && (
                      <Text style={notificationMessage}>
                        {notification.message}
                      </Text>
                    )}
                    {notification.link && (
                      <Link href={notification.link} style={link}>
                        View details →
                      </Link>
                    )}
                    <Text style={notificationTime}>
                      {new Date(notification.created_at).toLocaleString(
                        'en-GB',
                        {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </Text>
                  </Section>
                ))}
              </Section>

              <Section style={buttonContainer}>
                <Link href={dashboardLink} style={button}>
                  View All Notifications
                </Link>
              </Section>
            </>
          ) : (
            <Text style={text}>
              You have no new notifications for this{' '}
              {frequency === 'daily' ? 'day' : 'week'}.
            </Text>
          )}

          <Text style={footer}>
            You're receiving this email because you have email digest enabled in
            your notification preferences. You can change these settings in your{' '}
            <Link href={`${dashboardLink}/profile`} style={footerLink}>
              profile settings
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#0f172a',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const container = {
  backgroundColor: '#1e293b',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
  borderRadius: '8px',
};

const h1 = {
  color: '#f1f5f9',
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const text = {
  color: '#cbd5e1',
  fontSize: '16px',
  lineHeight: '24px',
  marginBottom: '16px',
};

const notificationsContainer = {
  marginTop: '24px',
  marginBottom: '24px',
};

const notificationItem = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '12px',
};

const notificationHeader = {
  color: '#94a3b8',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '8px',
};

const notificationTitle = {
  color: '#f1f5f9',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '8px',
};

const notificationMessage = {
  color: '#cbd5e1',
  fontSize: '14px',
  lineHeight: '20px',
  marginBottom: '8px',
};

const notificationTime = {
  color: '#64748b',
  fontSize: '12px',
  marginTop: '8px',
};

const link = {
  color: '#818cf8',
  textDecoration: 'underline',
  fontSize: '14px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '6px',
  display: 'inline-block',
};

const footer = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '18px',
  marginTop: '32px',
  paddingTop: '24px',
  borderTop: '1px solid #334155',
};

const footerLink = {
  color: '#818cf8',
  textDecoration: 'underline',
};
