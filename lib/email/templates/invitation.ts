import { baseTemplate } from "./base";
import { UserRole } from "@/lib/models";

export interface InvitationEmailData {
  name: string;
  email: string;
  role: UserRole;
  inviteUrl: string;
  expiryDays: number;
}

export function invitationEmailTemplate(data: InvitationEmailData): string {
  const roleLabel = data.role === UserRole.ADMIN ? "an Administrator" : "a Student";

  return baseTemplate({
    title: "You're Invited!",
    preheader: "You've been invited to ClassScheduler",
    colors: { header: "#2563eb" },
    content: `
      <div class="content">
        <p class="greeting">Hello ${data.name},</p>
        <p class="message">
          You've been invited to join <strong>ClassScheduler</strong> as ${roleLabel}.
        </p>
        <p class="message">
          ClassScheduler allows you to easily book classrooms at the Efi Arazi School of Computer Science.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Accept Invitation
          </a>
        </div>
        <div class="warning-box">
          <strong>Note:</strong> This invitation will expire in ${data.expiryDays} day${data.expiryDays === 1 ? "" : "s"}.
          If you didn't expect this invitation, you can safely ignore this email.
        </div>
        <p class="message" style="margin-top: 24px; font-size: 13px; color: #6b7280;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="word-break: break-all;">${data.inviteUrl}</span>
        </p>
      </div>
    `,
  });
}

// Plain text version for better deliverability
export function invitationEmailText(data: InvitationEmailData): string {
  const roleLabel = data.role === UserRole.ADMIN ? "an Administrator" : "a Student";

  return `
Hello ${data.name},

You've been invited to join ClassScheduler as ${roleLabel}.

ClassScheduler allows you to easily book classrooms at the Efi Arazi School of Computer Science.

Accept your invitation by clicking the link below:
${data.inviteUrl}

Note: This invitation will expire in ${data.expiryDays} day${data.expiryDays === 1 ? "" : "s"}. If you didn't expect this invitation, you can safely ignore this email.

---
ClassScheduler - Efi Arazi School of Computer Science
This is an automated message. Please do not reply to this email.
  `.trim();
}
