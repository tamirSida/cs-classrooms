import { baseTemplate, formatDate } from "./base";

export type SeriesEmailKind = "created" | "pending" | "cancelled" | "cancelledByAdmin" | "approved" | "rejected";

export interface SeriesEmailData {
  userName: string;
  classroomName: string;
  startTime: string;
  endTime: string;
  ruleText: string;
  dates: string[];
  skippedDates?: string[];
}

const SERIES_COPY: Record<
  SeriesEmailKind,
  { title: string; subject: string; header: string; message: string; listLabel: string }
> = {
  created: {
    title: "Recurring Booking Confirmed",
    subject: "Recurring Booking Confirmed",
    header: "#059669",
    message: "Your recurring classroom booking has been confirmed for the dates below.",
    listLabel: "Booked dates",
  },
  pending: {
    title: "Recurring Booking Submitted",
    subject: "Recurring Booking Submitted",
    header: "#f59e0b",
    message: "Your recurring booking request is awaiting admin approval. You will receive another email once it is reviewed.",
    listLabel: "Requested dates",
  },
  cancelled: {
    title: "Recurring Booking Cancelled",
    subject: "Recurring Booking Cancelled",
    header: "#6b7280",
    message: "The following dates of your recurring booking have been cancelled as requested.",
    listLabel: "Cancelled dates",
  },
  cancelledByAdmin: {
    title: "Recurring Booking Cancelled by Admin",
    subject: "Recurring Booking Cancelled",
    header: "#dc2626",
    message: "An administrator cancelled the following dates of your recurring booking. We apologize for any inconvenience.",
    listLabel: "Cancelled dates",
  },
  approved: {
    title: "Recurring Booking Approved",
    subject: "Recurring Booking Approved",
    header: "#059669",
    message: "Your recurring booking request has been approved for the dates below.",
    listLabel: "Approved dates",
  },
  rejected: {
    title: "Recurring Booking Declined",
    subject: "Recurring Booking Declined",
    header: "#dc2626",
    message: "Your recurring booking request was declined by an administrator.",
    listLabel: "Declined dates",
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function dateList(dates: string[]): string {
  return `<ul style="margin: 8px 0 0; padding-left: 20px;">${dates
    .map((d) => `<li>${formatDate(d)}</li>`)
    .join("")}</ul>`;
}

export function seriesEmailSubject(kind: SeriesEmailKind, classroomName: string): string {
  return `${SERIES_COPY[kind].subject} - ${classroomName}`;
}

export function seriesEmailTemplate(kind: SeriesEmailKind, data: SeriesEmailData): string {
  const copy = SERIES_COPY[kind];
  const classroom = escapeHtml(data.classroomName);
  return baseTemplate({
    title: copy.title,
    preheader: `${copy.title}: ${data.classroomName}`,
    colors: { header: copy.header },
    content: `
      <div class="content">
        <p class="greeting">Hello ${escapeHtml(data.userName)},</p>
        <p class="message">${copy.message}</p>
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Classroom:</span>
            <span class="detail-value">${classroom}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Repeats:</span>
            <span class="detail-value">${escapeHtml(data.ruleText)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">${data.startTime} - ${data.endTime}</span>
          </div>
        </div>
        <p class="message"><strong>${copy.listLabel} (${data.dates.length}):</strong></p>
        ${dateList(data.dates)}
        ${
          data.skippedDates?.length
            ? `<div class="warning-box"><strong>Not booked (unavailable):</strong>${dateList(data.skippedDates)}</div>`
            : ""
        }
      </div>
    `,
  });
}

export function seriesEmailText(kind: SeriesEmailKind, data: SeriesEmailData): string {
  const copy = SERIES_COPY[kind];
  const lines = [
    `Hello ${data.userName},`,
    "",
    copy.message,
    "",
    `Classroom: ${data.classroomName}`,
    `Repeats: ${data.ruleText}`,
    `Time: ${data.startTime} - ${data.endTime}`,
    "",
    `${copy.listLabel} (${data.dates.length}):`,
    ...data.dates.map((d) => `- ${formatDate(d)}`),
  ];
  if (data.skippedDates?.length) {
    lines.push("", "Not booked (unavailable):", ...data.skippedDates.map((d) => `- ${formatDate(d)}`));
  }
  return lines.join("\n");
}
