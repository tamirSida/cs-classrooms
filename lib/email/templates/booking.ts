import { baseTemplate, bookingDetailsCard, formatDate } from "./base";

export interface BookingEmailData {
  userName: string;
  userEmail: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
}

// Booking confirmed (auto-approved or no approval needed)
export function bookingConfirmedTemplate(data: BookingEmailData): string {
  return baseTemplate({
    title: "Booking Confirmed",
    preheader: `Your booking for ${data.classroomName} has been confirmed`,
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Great news! Your classroom booking has been confirmed and is ready for you.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Confirmed", class: "status-confirmed" }
        )}
        <div class="highlight-box">
          <strong>Remember:</strong> Please arrive on time and ensure the room is left clean after use.
        </div>
      </div>
    `,
  });
}

// Booking pending approval
export function bookingPendingTemplate(data: BookingEmailData): string {
  return baseTemplate({
    title: "Booking Submitted",
    preheader: `Your booking request for ${data.classroomName} is pending approval`,
    colors: { header: "#f59e0b", headerText: "#ffffff" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Your booking request has been submitted and is awaiting admin approval.
          You will receive another email once your booking is approved or declined.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Pending Approval", class: "status-pending" }
        )}
        <div class="warning-box">
          <strong>Note:</strong> This booking is not yet confirmed. Please wait for approval before planning to use the room.
        </div>
      </div>
    `,
  });
}

// Booking approved by admin
export function bookingApprovedTemplate(data: BookingEmailData): string {
  return baseTemplate({
    title: "Booking Approved",
    preheader: `Your booking for ${data.classroomName} has been approved!`,
    colors: { header: "#059669" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Your booking request has been approved by an administrator.
          The classroom is now reserved for you at the scheduled time.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Approved", class: "status-confirmed" }
        )}
        <div class="highlight-box">
          <strong>You're all set!</strong> Please arrive on time and ensure the room is left clean after use.
        </div>
      </div>
    `,
  });
}

// Booking cancelled by the user themselves
export function bookingCancelledByUserTemplate(data: BookingEmailData): string {
  return baseTemplate({
    title: "Booking Cancelled",
    preheader: `Your booking for ${data.classroomName} has been cancelled`,
    colors: { header: "#6b7280" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Your booking has been successfully cancelled as requested.
          The time slot is now available for others to book.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Cancelled", class: "status-cancelled" }
        )}
        <p class="message" style="margin-top: 24px;">
          Need to book again? Visit the ClassScheduler to make a new reservation.
        </p>
      </div>
    `,
  });
}

// Booking cancelled by an admin
export function bookingCancelledByAdminTemplate(
  data: BookingEmailData,
  reason?: string
): string {
  return baseTemplate({
    title: "Booking Cancelled by Admin",
    preheader: `Unfortunately, your booking for ${data.classroomName} has been cancelled`,
    colors: { header: "#dc2626" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Unfortunately, your booking has been cancelled by an administrator.
          We apologize for any inconvenience this may cause.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Cancelled", class: "status-cancelled" }
        )}
        ${
          reason
            ? `
        <div class="warning-box">
          <strong>Reason:</strong> ${reason}
        </div>
        `
            : ""
        }
        <p class="message" style="margin-top: 24px;">
          If you have any questions, please contact the administration.
          You may also try booking a different time slot.
        </p>
      </div>
    `,
  });
}

// Booking rejected (denied approval)
export function bookingRejectedTemplate(
  data: BookingEmailData,
  reason?: string
): string {
  return baseTemplate({
    title: "Booking Request Declined",
    preheader: `Your booking request for ${data.classroomName} was not approved`,
    colors: { header: "#dc2626" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          We regret to inform you that your booking request has been declined by an administrator.
        </p>
        ${bookingDetailsCard(
          data.classroomName,
          data.date,
          data.startTime,
          data.endTime,
          { text: "Declined", class: "status-cancelled" }
        )}
        ${
          reason
            ? `
        <div class="warning-box">
          <strong>Reason:</strong> ${reason}
        </div>
        `
            : ""
        }
        <p class="message" style="margin-top: 24px;">
          You may submit a new booking request for a different time or classroom.
        </p>
      </div>
    `,
  });
}

// Booking modified by user
export interface BookingModifiedData extends BookingEmailData {
  oldDate: string;
  oldStartTime: string;
  oldEndTime: string;
}

export function bookingModifiedTemplate(data: BookingModifiedData): string {
  return baseTemplate({
    title: "Booking Modified",
    preheader: `Your booking for ${data.classroomName} has been updated`,
    colors: { header: "#8b5cf6" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.userName},</p>
        <p class="message">
          Your booking has been successfully modified. Please review the changes below.
        </p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Classroom:</span>
            <span class="detail-value">${data.classroomName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Previous Date:</span>
            <span class="detail-value old-value">${formatDate(data.oldDate)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">New Date:</span>
            <span class="detail-value new-value">${formatDate(data.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Previous Time:</span>
            <span class="detail-value old-value">${data.oldStartTime} - ${data.oldEndTime}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">New Time:</span>
            <span class="detail-value new-value">${data.startTime} - ${data.endTime}</span>
          </div>
        </div>
        <div class="highlight-box">
          <strong>Updated!</strong> Your booking has been changed to the new date and time shown above.
        </div>
      </div>
    `,
  });
}
