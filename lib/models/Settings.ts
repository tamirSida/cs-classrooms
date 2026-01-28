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
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ISettingsUpdate {
  operatingHours?: IOperatingHours;
  defaultMaxTimePerDay?: number;
  timeSlotDuration?: number;
}

export class Settings implements ISettings {
  constructor(
    public id: string,
    public operatingHours: IOperatingHours,
    public defaultMaxTimePerDay: number,
    public timeSlotDuration: number,
    public updatedAt: Timestamp,
    public updatedBy: string
  ) {}

  static readonly DOCUMENT_ID = "global";
  static readonly DEFAULT_SLOT_DURATION = 15;

  static fromFirestore(data: ISettings): Settings {
    return new Settings(
      data.id,
      data.operatingHours,
      data.defaultMaxTimePerDay,
      data.timeSlotDuration,
      data.updatedAt,
      data.updatedBy
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
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };
  }

  toFirestore(): Omit<ISettings, "id"> {
    return {
      operatingHours: this.operatingHours,
      defaultMaxTimePerDay: this.defaultMaxTimePerDay,
      timeSlotDuration: this.timeSlotDuration,
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
