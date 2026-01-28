import { Resend } from "resend";
import { IBooking } from "@/lib/models";

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private static instance: EmailService;
  private resend: Resend | null = null;
  private fromEmail: string;

  private constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private async send(template: EmailTemplate): Promise<boolean> {
    if (!this.resend) {
      console.warn("Resend not configured, skipping email");
      return false;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: template.to,
        subject: template.subject,
        html: template.html,
      });
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendBookingConfirmation(
    booking: IBooking,
    classroomName: string
  ): Promise<boolean> {
    const statusText = booking.status === "pending" ? "Pending Approval" : "Confirmed";

    return this.send({
      to: booking.userEmail,
      subject: `Booking ${statusText} - ${classroomName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
              .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
              .status-confirmed { background: #dcfce7; color: #166534; }
              .status-pending { background: #fef9c3; color: #854d0e; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking ${statusText}</h1>
              </div>
              <div class="content">
                <p>Hello ${booking.userName},</p>
                <p>Your booking has been ${booking.status === "pending" ? "submitted and is pending approval" : "confirmed"}.</p>
                <div class="details">
                  <div class="detail-row">
                    <strong>Classroom:</strong>
                    <span>${classroomName}</span>
                  </div>
                  <div class="detail-row">
                    <strong>Date:</strong>
                    <span>${booking.date}</span>
                  </div>
                  <div class="detail-row">
                    <strong>Time:</strong>
                    <span>${booking.startTime} - ${booking.endTime}</span>
                  </div>
                  <div class="detail-row">
                    <strong>Status:</strong>
                    <span class="status ${booking.status === "confirmed" ? "status-confirmed" : "status-pending"}">${statusText}</span>
                  </div>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  }

  async sendBookingModified(
    booking: IBooking,
    classroomName: string,
    oldDate: string,
    oldStartTime: string,
    oldEndTime: string
  ): Promise<boolean> {
    return this.send({
      to: booking.userEmail,
      subject: `Booking Modified - ${classroomName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .old { text-decoration: line-through; color: #999; }
              .new { color: #166534; font-weight: bold; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Modified</h1>
              </div>
              <div class="content">
                <p>Hello ${booking.userName},</p>
                <p>Your booking has been modified.</p>
                <div class="details">
                  <p><strong>Classroom:</strong> ${classroomName}</p>
                  <p><strong>Previous:</strong> <span class="old">${oldDate} ${oldStartTime} - ${oldEndTime}</span></p>
                  <p><strong>New:</strong> <span class="new">${booking.date} ${booking.startTime} - ${booking.endTime}</span></p>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  }

  async sendBookingCancelled(
    booking: IBooking,
    classroomName: string
  ): Promise<boolean> {
    return this.send({
      to: booking.userEmail,
      subject: `Booking Cancelled - ${classroomName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Cancelled</h1>
              </div>
              <div class="content">
                <p>Hello ${booking.userName},</p>
                <p>Your booking has been cancelled.</p>
                <div class="details">
                  <p><strong>Classroom:</strong> ${classroomName}</p>
                  <p><strong>Date:</strong> ${booking.date}</p>
                  <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  }
}

export const emailService = EmailService.getInstance();
