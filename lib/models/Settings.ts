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
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ISettingsUpdate {
  operatingHours?: IOperatingHours;
  defaultMaxTimePerDay?: number;
  timeSlotDuration?: number;
  requiresApproval?: boolean;
  signupCode?: string;
}

export class Settings implements ISettings {
  constructor(
    public id: string,
    public operatingHours: IOperatingHours,
    public defaultMaxTimePerDay: number,
    public timeSlotDuration: number,
    public requiresApproval: boolean,
    public updatedAt: Timestamp,
    public updatedBy: string,
    public signupCode?: string
  ) {}

  static readonly DOCUMENT_ID = "global";
  static readonly DEFAULT_SLOT_DURATION = 15;

  static fromFirestore(data: ISettings): Settings {
    return new Settings(
      data.id,
      data.operatingHours,
      data.defaultMaxTimePerDay,
      data.timeSlotDuration,
      data.requiresApproval ?? false,
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
