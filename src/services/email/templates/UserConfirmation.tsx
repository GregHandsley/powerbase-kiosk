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

interface UserConfirmationProps {
  bookingTitle: string;
  bookingDate: string;
  bookingTime: string;
  side: string;
  racks: string;
  athletes: number;
  bookingLink: string;
  isEdit?: boolean;
}

export function UserConfirmation({
  bookingTitle,
  bookingDate,
  bookingTime,
  side,
  racks,
  athletes,
  bookingLink,
  isEdit = false,
}: UserConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {isEdit
          ? `Your booking has been updated: ${bookingTitle}`
          : `Your booking has been received: ${bookingTitle}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isEdit ? 'Booking Updated' : 'Booking Confirmation'}
          </Heading>

          <Section style={section}>
            <Text style={text}>
              {isEdit
                ? 'Your booking has been successfully updated.'
                : "Thank you for your booking. We've received your request."}
            </Text>

            {!isEdit && (
              <Text style={notice}>
                ⚠️ This booking was created after the notification window
                deadline. The bookings team will review it and may need to make
                adjustments.
              </Text>
            )}

            <Section style={bookingDetails}>
              <Text style={label}>Booking Details:</Text>
              <Text style={detail}>
                <strong>Title:</strong> {bookingTitle}
              </Text>
              <Text style={detail}>
                <strong>Date:</strong> {bookingDate}
              </Text>
              <Text style={detail}>
                <strong>Time:</strong> {bookingTime}
              </Text>
              <Text style={detail}>
                <strong>Side:</strong> {side}
              </Text>
              <Text style={detail}>
                <strong>Racks/Platforms:</strong> {racks}
              </Text>
              <Text style={detail}>
                <strong>Athletes:</strong> {athletes}
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href={bookingLink} style={button}>
                View Booking
              </Link>
            </Section>

            <Text style={footer}>
              If you have any questions or need to make changes, please contact
              the bookings team.
            </Text>
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

const text = {
  color: '#cbd5e1',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const notice = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fbbf24',
  borderRadius: '6px',
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '16px 0',
  padding: '12px',
};

const bookingDetails = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0',
};

const label = {
  color: '#f1f5f9',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const detail = {
  color: '#cbd5e1',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '8px 0',
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

const footer = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '24px 0 0',
  paddingTop: '16px',
  borderTop: '1px solid #334155',
};

export default UserConfirmation;
