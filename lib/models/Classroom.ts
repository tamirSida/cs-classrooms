import { Timestamp } from "firebase/firestore";

export enum ClassroomPermission {
  ADMIN_ONLY = "admin_only",
  STUDENT = "student",
}

export interface IClassroomConfig {
  permissions: ClassroomPermission;
  maxTimePerDay: number; // Minutes, 0 = use global setting
  requiresApproval: boolean;
  isActive: boolean;
}

export interface IClassroom {
  id: string;
  name: string;
  description?: string;
  config: IClassroomConfig;
  assignedAdmins: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IClassroomCreate {
  name: string;
  description?: string;
  config: IClassroomConfig;
  assignedAdmins?: string[];
}

export interface IClassroomUpdate {
  name?: string;
  description?: string;
  config?: Partial<IClassroomConfig>;
  assignedAdmins?: string[];
}

export class Classroom implements IClassroom {
  constructor(
    public id: string,
    public name: string,
    public description: string | undefined,
    public config: IClassroomConfig,
    public assignedAdmins: string[],
    public createdAt: Timestamp,
    public updatedAt: Timestamp
  ) {}

  static fromFirestore(id: string, data: Omit<IClassroom, "id">): Classroom {
    return new Classroom(
      id,
      data.name,
      data.description,
      data.config,
      data.assignedAdmins || [],
      data.createdAt,
      data.updatedAt
    );
  }

  static createDefault(name: string): IClassroomConfig {
    return {
      permissions: ClassroomPermission.STUDENT,
      maxTimePerDay: 0,
      requiresApproval: false,
      isActive: true,
    };
  }

  toFirestore(): Omit<IClassroom, "id"> {
    return {
      name: this.name,
      description: this.description,
      config: this.config,
      assignedAdmins: this.assignedAdmins,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  isActive(): boolean {
    return this.config.isActive;
  }

  allowsStudentBooking(): boolean {
    return this.config.permissions === ClassroomPermission.STUDENT;
  }

  requiresApproval(): boolean {
    return this.config.requiresApproval;
  }

  getMaxTimePerDay(): number {
    return this.config.maxTimePerDay;
  }

  isAdminAssigned(userId: string): boolean {
    return this.assignedAdmins.includes(userId);
  }
}
