import { Timestamp } from "firebase/firestore";

export interface IOperatingHours {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface ISettings {
  id: string;
  operatingHours: IOperatingHours;
  defaultMaxTimePerDay: number; // Minutes, -1 = unlimited
  timeSlotDuration: number; // Minutes (5, 10, 15, 30, 60)
  requiresApproval: boolean; // Global setting - student bookings need admin approval
  signupCode?: string; // Code for QR-based student self-signup
  restrictSignupDomain: boolean; // Restrict QR/link signup to allowedSignupDomains
  allowedSignupDomains: string[]; // Matches the domain and its subdomains
  adminCanOverrideBookings: boolean; // Admins may modify/cancel any booking when true. Super-admins always can.
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ISettingsUpdate {
  operatingHours?: IOperatingHours;
  defaultMaxTimePerDay?: number;
  timeSlotDuration?: number;
  requiresApproval?: boolean;
  signupCode?: string;
  restrictSignupDomain?: boolean;
  allowedSignupDomains?: string[];
  adminCanOverrideBookings?: boolean;
}

export class Settings implements ISettings {
  constructor(
    public id: string,
    public operatingHours: IOperatingHours,
    public defaultMaxTimePerDay: number,
    public timeSlotDuration: number,
    public requiresApproval: boolean,
    public restrictSignupDomain: boolean,
    public allowedSignupDomains: string[],
    public adminCanOverrideBookings: boolean,
    public updatedAt: Timestamp,
    public updatedBy: string,
    public signupCode?: string
  ) {}

  static readonly DOCUMENT_ID = "global";
  static readonly DEFAULT_SLOT_DURATION = 15;
  static readonly DEFAULT_ALLOWED_DOMAINS: string[] = ["runi.ac.il"];

  static fromFirestore(data: ISettings): Settings {
    return new Settings(
      data.id,
      data.operatingHours,
      data.defaultMaxTimePerDay,
      data.timeSlotDuration,
      data.requiresApproval ?? false,
      data.restrictSignupDomain ?? true,
      data.allowedSignupDomains ?? Settings.DEFAULT_ALLOWED_DOMAINS,
      data.adminCanOverrideBookings ?? false,
      data.updatedAt,
      data.updatedBy,
      data.signupCode
    );
  }

  static createDefault(userId: string): Omit<ISettings, "id"> {
    return {
      operatingHours: {
        start: "08:00",
        end: "18:00",
      },
      defaultMaxTimePerDay: 60,
      timeSlotDuration: 15,
      requiresApproval: false,
      restrictSignupDomain: true,
      allowedSignupDomains: [...Settings.DEFAULT_ALLOWED_DOMAINS],
      adminCanOverrideBookings: false,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };
  }

  toFirestore(): Omit<ISettings, "id"> {
    return {
      operatingHours: this.operatingHours,
      defaultMaxTimePerDay: this.defaultMaxTimePerDay,
      timeSlotDuration: this.timeSlotDuration,
      requiresApproval: this.requiresApproval,
      signupCode: this.signupCode,
      restrictSignupDomain: this.restrictSignupDomain,
      allowedSignupDomains: this.allowedSignupDomains,
      adminCanOverrideBookings: this.adminCanOverrideBookings,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }

  getOperatingHoursStart(): string {
    return this.operatingHours.start;
  }

  getOperatingHoursEnd(): string {
    return this.operatingHours.end;
  }
}
