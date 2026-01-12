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
import * as React from 'react';

interface DailyReminderProps {
  date: string;
  pendingCount: number;
  lastMinuteCount: number;
  urgentCount: number;
  dashboardLink: string;
}

export function DailyReminder({
  date,
  pendingCount,
  lastMinuteCount,
  urgentCount,
  dashboardLink,
}: DailyReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Daily Booking Summary - {date}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Daily Booking Summary</Heading>

          <Section style={section}>
            <Text style={dateText}>{date}</Text>

            <Section style={statsSection}>
              <Section style={statBox}>
                <Text style={statNumber}>{pendingCount}</Text>
                <Text style={statLabel}>Pending Bookings</Text>
              </Section>

              <Section style={statBox}>
                <Text style={statNumber}>{lastMinuteCount}</Text>
                <Text style={statLabel}>Last-Minute Changes</Text>
              </Section>

              <Section style={statBox}>
                <Text style={statNumber}>{urgentCount}</Text>
                <Text style={statLabel}>Urgent (Next 7 Days)</Text>
              </Section>
            </Section>

            {pendingCount === 0 &&
            lastMinuteCount === 0 &&
            urgentCount === 0 ? (
              <Text style={text}>
                Great news! There are no pending items requiring attention
                today.
              </Text>
            ) : (
              <>
                <Text style={text}>
                  You have {pendingCount} pending booking
                  {pendingCount !== 1 ? 's' : ''} that need processing.
                </Text>
                {lastMinuteCount > 0 && (
                  <Text style={text}>
                    {lastMinuteCount} last-minute change
                    {lastMinuteCount !== 1 ? 's' : ''} require your attention.
                  </Text>
                )}
                {urgentCount > 0 && (
                  <Text style={urgentText}>
                    ⚠️ {urgentCount} urgent booking
                    {urgentCount !== 1 ? 's' : ''} in the next 7 days need
                    immediate attention.
                  </Text>
                )}
              </>
            )}

            <Section style={buttonSection}>
              <Link href={dashboardLink} style={button}>
                View Bookings Dashboard
              </Link>
            </Section>
          </Section>
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
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  maxWidth: '600px',
};

const h1 = {
  color: '#f1f5f9',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 24px',
  padding: '0 24px',
};

const section = {
  padding: '0 24px',
};

const dateText = {
  color: '#94a3b8',
  fontSize: '14px',
  margin: '0 0 24px',
};

const statsSection = {
  display: 'flex',
  gap: '12px',
  margin: '24px 0',
  flexWrap: 'wrap' as const,
};

const statBox = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  padding: '16px',
  flex: '1',
  minWidth: '120px',
  textAlign: 'center' as const,
};

const statNumber = {
  color: '#4f46e5',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '1',
  margin: '0 0 8px',
};

const statLabel = {
  color: '#cbd5e1',
  fontSize: '12px',
  margin: '0',
};

const text = {
  color: '#cbd5e1',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
};

const urgentText = {
  color: '#fbbf24',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
  fontWeight: '600',
};

const buttonSection = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

export default DailyReminder;
