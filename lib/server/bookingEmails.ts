import "server-only";
import { Resend } from "resend";
import {
  BookingEmailData,
  bookingApprovedTemplate,
  bookingCancelledByAdminTemplate,
  bookingCancelledByUserTemplate,
  bookingConfirmedTemplate,
  bookingConfirmedText,
  bookingModifiedTemplate,
  bookingPendingTemplate,
  bookingPendingText,
  bookingRejectedTemplate,
  SeriesEmailData,
  SeriesEmailKind,
  seriesEmailSubject,
  seriesEmailTemplate,
  seriesEmailText,
} from "@/lib/email";

interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Single Resend entry point. Never throws: a failed email must not fail the booking.
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not configured, skipping "${email.subject}"`);
    return false;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "room@efi-arazi.com";
  const fromName = process.env.RESEND_FROM_NAME || "ClassScheduler";

  try {
    const { error } = await new Resend(apiKey).emails.send({ from: `${fromName} <${fromEmail}>`, ...email });
    if (error) {
      console.error("[email] Resend error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return false;
  }
}

export type SingleBookingEmail =
  | { kind: "confirmed" | "pending" | "approved" | "rejected" | "cancelledByUser" | "cancelledByAdmin" }
  | { kind: "modified"; oldDate: string; oldStartTime: string; oldEndTime: string };

export interface EmailBooking {
  userName: string;
  userEmail: string;
  date: string;
  startTime: string;
  endTime: string;
}

export async function sendBookingEmail(
  booking: EmailBooking,
  classroomName: string,
  email: SingleBookingEmail
): Promise<boolean> {
  const data: BookingEmailData = { ...booking, classroomName };
  const content = (() => {
    switch (email.kind) {
      case "confirmed":
        return { subject: "Booking Confirmed", html: bookingConfirmedTemplate(data), text: bookingConfirmedText(data) };
      case "pending":
        return { subject: "Booking Submitted", html: bookingPendingTemplate(data), text: bookingPendingText(data) };
      case "approved":
        return { subject: "Booking Approved", html: bookingApprovedTemplate(data) };
      case "rejected":
        return { subject: "Booking Request Declined", html: bookingRejectedTemplate(data) };
      case "cancelledByUser":
        return { subject: "Booking Cancelled", html: bookingCancelledByUserTemplate(data) };
      case "cancelledByAdmin":
        return { subject: "Booking Cancelled", html: bookingCancelledByAdminTemplate(data) };
      case "modified":
        return { subject: "Booking Modified", html: bookingModifiedTemplate({ ...data, ...email }) };
    }
  })();

  return sendEmail({ to: booking.userEmail, ...content, subject: `${content.subject} - ${classroomName}` });
}

export async function sendSeriesEmail(
  to: string,
  kind: SeriesEmailKind,
  data: SeriesEmailData
): Promise<boolean> {
  if (data.dates.length === 0) return false;
  return sendEmail({
    to,
    subject: seriesEmailSubject(kind, data.classroomName),
    html: seriesEmailTemplate(kind, data),
    text: seriesEmailText(kind, data),
  });
}
