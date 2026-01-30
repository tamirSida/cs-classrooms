import { Timestamp } from "firebase/firestore";
import { UserRole } from "./User";

export interface IInvitation {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  used: boolean;
  usedAt?: Timestamp;
}

export interface IInvitationCreate {
  email: string;
  name: string;
  role: UserRole;
}

export interface IBulkInviteRequest {
  invitations: IInvitationCreate[];
}

export interface IBulkInviteResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export interface IValidateInvitationResponse {
  valid: boolean;
  email?: string;
  name?: string;
  role?: UserRole;
  error?: string;
}
