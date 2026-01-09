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
} from "@react-email/components";
import * as React from "react";

interface LastMinuteAlertProps {
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

export function LastMinuteAlert({
  bookingTitle,
  bookingDate,
  bookingTime,
  side,
  racks,
  athletes,
  createdBy,
  createdAt,
  bookingLink,
  isEdit = false,
  changes,
}: LastMinuteAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {isEdit
          ? `Last-minute change to booking: ${bookingTitle}`
          : `Last-minute booking created: ${bookingTitle}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isEdit ? "Last-Minute Booking Change" : "Last-Minute Booking Created"}
          </Heading>

          <Section style={section}>
            <Text style={text}>
              {isEdit
                ? "A booking has been modified after the notification window deadline."
                : "A new booking has been created after the notification window deadline."}
            </Text>

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
              {isEdit && changes && (
                <Text style={detail}>
                  <strong>Changes:</strong> {changes}
                </Text>
              )}
            </Section>

            <Section style={metaSection}>
              <Text style={metaText}>
                <strong>Created/Modified by:</strong> {createdBy}
              </Text>
              <Text style={metaText}>
                <strong>Time:</strong> {createdAt}
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href={bookingLink} style={button}>
                View Booking
              </Link>
            </Section>

            <Text style={footer}>
              This booking was created or modified after the notification window deadline.
              Please review and make any necessary adjustments.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#0f172a",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const container = {
  backgroundColor: "#1e293b",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  borderRadius: "8px",
  maxWidth: "600px",
};

const h1 = {
  color: "#f1f5f9",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 24px",
  padding: "0 24px",
};

const section = {
  padding: "0 24px",
};

const text = {
  color: "#cbd5e1",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const bookingDetails = {
  backgroundColor: "#0f172a",
  borderRadius: "6px",
  padding: "16px",
  margin: "24px 0",
};

const label = {
  color: "#f1f5f9",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 12px",
};

const detail = {
  color: "#cbd5e1",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "8px 0",
};

const metaSection = {
  margin: "24px 0",
  paddingTop: "16px",
  borderTop: "1px solid #334155",
};

const metaText = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "4px 0",
};

const buttonSection = {
  margin: "32px 0",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#4f46e5",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const footer = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "24px 0 0",
  paddingTop: "16px",
  borderTop: "1px solid #334155",
};

export default LastMinuteAlert;

