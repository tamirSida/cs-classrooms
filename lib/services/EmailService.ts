import { Resend } from "resend";
import { IBooking } from "@/lib/models";
import {
  bookingConfirmedTemplate,
  bookingPendingTemplate,
  bookingApprovedTemplate,
  bookingCancelledByUserTemplate,
  bookingCancelledByAdminTemplate,
  bookingRejectedTemplate,
  bookingModifiedTemplate,
  BookingEmailData,
  BookingModifiedData,
} from "@/lib/email";

export class EmailService {
  private static instance: EmailService;
  private resend: Resend | null = null;
  private fromEmail: string;
  private fromName: string;

  private constructor() {
    const hasApiKey = !!process.env.RESEND_API_KEY;
    console.log(`[EmailService] Initializing - RESEND_API_KEY present: ${hasApiKey}`);

    if (hasApiKey) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "room@efi-arazi.com";
    this.fromName = process.env.RESEND_FROM_NAME || "ClassScheduler";
    console.log(`[EmailService] Configured from: ${this.fromName} <${this.fromEmail}>`);
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private get from(): string {
    return `${this.fromName} <${this.fromEmail}>`;
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    console.log(`[EmailService] Attempting to send email to: ${to}, subject: ${subject}`);

    if (!this.resend) {
      console.warn("[EmailService] Resend not configured (RESEND_API_KEY missing), skipping email to:", to);
      console.log("[EmailService] Email content that would have been sent:", { to, subject, from: this.from });
      return false;
    }

    try {
      console.log(`[EmailService] Sending via Resend from: ${this.from}`);
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (error) {
        console.error("[EmailService] Resend API error:", error);
        return false;
      }

      console.log(`[EmailService] Email sent successfully! ID: ${data?.id}`);
      return true;
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error);
      return false;
    }
  }

  private bookingToEmailData(booking: IBooking, classroomName: string): BookingEmailData {
    return {
      userName: booking.userName,
      userEmail: booking.userEmail,
      classroomName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };
  }

  // Called when a booking is created
  async sendBookingConfirmation(booking: IBooking, classroomName: string): Promise<boolean> {
    console.log(`[EmailService] sendBookingConfirmation called - status: ${booking.status}, user: ${booking.userEmail}`);

    const data = this.bookingToEmailData(booking, classroomName);
    const isPending = booking.status === "pending";

    const html = isPending
      ? bookingPendingTemplate(data)
      : bookingConfirmedTemplate(data);

    const subject = isPending
      ? `Booking Submitted - ${classroomName}`
      : `Booking Confirmed - ${classroomName}`;

    console.log(`[EmailService] Using template: ${isPending ? "pending" : "confirmed"}`);
    return this.send(booking.userEmail, subject, html);
  }

  // Called when a pending booking is approved
  async sendBookingApproved(booking: IBooking, classroomName: string): Promise<boolean> {
    const data = this.bookingToEmailData(booking, classroomName);
    const html = bookingApprovedTemplate(data);

    return this.send(
      booking.userEmail,
      `Booking Approved - ${classroomName}`,
      html
    );
  }

  // Called when a pending booking is rejected
  async sendBookingRejected(
    booking: IBooking,
    classroomName: string,
    reason?: string
  ): Promise<boolean> {
    const data = this.bookingToEmailData(booking, classroomName);
    const html = bookingRejectedTemplate(data, reason);

    return this.send(
      booking.userEmail,
      `Booking Request Declined - ${classroomName}`,
      html
    );
  }

  // Called when a user cancels their own booking
  async sendBookingCancelledByUser(booking: IBooking, classroomName: string): Promise<boolean> {
    const data = this.bookingToEmailData(booking, classroomName);
    const html = bookingCancelledByUserTemplate(data);

    return this.send(
      booking.userEmail,
      `Booking Cancelled - ${classroomName}`,
      html
    );
  }

  // Called when an admin cancels someone's booking
  async sendBookingCancelledByAdmin(
    booking: IBooking,
    classroomName: string,
    reason?: string
  ): Promise<boolean> {
    const data = this.bookingToEmailData(booking, classroomName);
    const html = bookingCancelledByAdminTemplate(data, reason);

    return this.send(
      booking.userEmail,
      `Booking Cancelled by Admin - ${classroomName}`,
      html
    );
  }

  // Legacy method - determines which cancellation email to send based on who cancelled
  async sendBookingCancelled(
    booking: IBooking,
    classroomName: string,
    cancelledByUserId?: string
  ): Promise<boolean> {
    const isOwnCancellation = !cancelledByUserId || cancelledByUserId === booking.userId;

    if (isOwnCancellation) {
      return this.sendBookingCancelledByUser(booking, classroomName);
    } else {
      return this.sendBookingCancelledByAdmin(booking, classroomName);
    }
  }

  // Called when a booking is modified
  async sendBookingModified(
    booking: IBooking,
    classroomName: string,
    oldDate: string,
    oldStartTime: string,
    oldEndTime: string
  ): Promise<boolean> {
    const data: BookingModifiedData = {
      ...this.bookingToEmailData(booking, classroomName),
      oldDate,
      oldStartTime,
      oldEndTime,
    };

    const html = bookingModifiedTemplate(data);

    return this.send(
      booking.userEmail,
      `Booking Modified - ${classroomName}`,
      html
    );
  }
}

export const emailService = EmailService.getInstance();
