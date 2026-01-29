// Base email template builder
export interface EmailColors {
  primary: string;
  header: string;
  headerText: string;
}

const defaultColors: EmailColors = {
  primary: "#2563eb",
  header: "#2563eb",
  headerText: "#ffffff",
};

export interface BaseTemplateOptions {
  title: string;
  preheader?: string;
  colors?: Partial<EmailColors>;
  content: string;
}

export function baseTemplate(options: BaseTemplateOptions): string {
  const colors = { ...defaultColors, ...options.colors };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options.title}</title>
  ${options.preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${options.preheader}</span>` : ""}
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
    }
    .wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: ${colors.header};
      color: ${colors.headerText};
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .details-card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #374151;
    }
    .detail-value {
      color: #6b7280;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
    }
    .status-confirmed {
      background-color: #dcfce7;
      color: #166534;
    }
    .status-pending {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-cancelled {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .highlight-box {
      background-color: #eff6ff;
      border-left: 4px solid ${colors.primary};
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .old-value {
      text-decoration: line-through;
      color: #9ca3af;
    }
    .new-value {
      color: #059669;
      font-weight: 600;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0;
      font-size: 13px;
      color: #6b7280;
    }
    .footer a {
      color: ${colors.primary};
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 20px 10px;
      }
      .header {
        padding: 24px 16px;
      }
      .content {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${options.title}</h1>
      </div>
      ${options.content}
      <div class="footer">
        <p>ClassScheduler - Efi Arazi School of Computer Science</p>
        <p style="margin-top: 8px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Helper to format date nicely
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Helper to create a booking details card
export function bookingDetailsCard(
  classroomName: string,
  date: string,
  startTime: string,
  endTime: string,
  status?: { text: string; class: string }
): string {
  return `
    <div class="details-card">
      <div class="detail-row">
        <span class="detail-label">Classroom:</span>
        <span class="detail-value">${classroomName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${startTime} - ${endTime}</span>
      </div>
      ${
        status
          ? `
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="status-badge ${status.class}">${status.text}</span>
      </div>
      `
          : ""
      }
    </div>
  `;
}
