import { Timestamp } from "firebase/firestore";

export enum ClassroomPermission {
  ADMIN_ONLY = "admin_only",
  STUDENT = "student",
}

export interface IClassroomConfig {
  permissions: ClassroomPermission;
  maxTimePerDay: number; // Minutes: 0 = use global default, -1 = unlimited, >0 = custom value
  requiresApproval: boolean;
  isActive: boolean;
}

// Available classroom colors
export const CLASSROOM_COLOR_OPTIONS = [
  { id: "blue", bg: "bg-blue-500", text: "text-white", light: "bg-blue-100", border: "border-blue-500", label: "Blue" },
  { id: "emerald", bg: "bg-emerald-500", text: "text-white", light: "bg-emerald-100", border: "border-emerald-500", label: "Emerald" },
  { id: "purple", bg: "bg-purple-500", text: "text-white", light: "bg-purple-100", border: "border-purple-500", label: "Purple" },
  { id: "orange", bg: "bg-orange-500", text: "text-white", light: "bg-orange-100", border: "border-orange-500", label: "Orange" },
  { id: "pink", bg: "bg-pink-500", text: "text-white", light: "bg-pink-100", border: "border-pink-500", label: "Pink" },
  { id: "cyan", bg: "bg-cyan-500", text: "text-white", light: "bg-cyan-100", border: "border-cyan-500", label: "Cyan" },
  { id: "amber", bg: "bg-amber-500", text: "text-white", light: "bg-amber-100", border: "border-amber-500", label: "Amber" },
  { id: "indigo", bg: "bg-indigo-500", text: "text-white", light: "bg-indigo-100", border: "border-indigo-500", label: "Indigo" },
  { id: "red", bg: "bg-red-500", text: "text-white", light: "bg-red-100", border: "border-red-500", label: "Red" },
  { id: "teal", bg: "bg-teal-500", text: "text-white", light: "bg-teal-100", border: "border-teal-500", label: "Teal" },
] as const;

export type ClassroomColorId = typeof CLASSROOM_COLOR_OPTIONS[number]["id"];

export interface IClassroom {
  id: string;
  name: string;
  description?: string;
  color?: ClassroomColorId; // Color ID from CLASSROOM_COLOR_OPTIONS
  config: IClassroomConfig;
  assignedAdmins: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IClassroomCreate {
  name: string;
  description?: string;
  color?: ClassroomColorId;
  config: IClassroomConfig;
  assignedAdmins?: string[];
}

export interface IClassroomUpdate {
  name?: string;
  description?: string;
  color?: ClassroomColorId;
  config?: Partial<IClassroomConfig>;
  assignedAdmins?: string[];
}

export class Classroom implements IClassroom {
  constructor(
    public id: string,
    public name: string,
    public description: string | undefined,
    public color: ClassroomColorId | undefined,
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
      data.color,
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
      color: this.color,
      config: this.config,
      assignedAdmins: this.assignedAdmins,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  getColorConfig() {
    return getClassroomColor(this.color);
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

// Helper function to get color config by ID
export function getClassroomColor(colorId?: ClassroomColorId, fallbackIndex?: number) {
  if (colorId) {
    const color = CLASSROOM_COLOR_OPTIONS.find((c) => c.id === colorId);
    if (color) return color;
  }
  // Fallback to index-based color or first color
  return CLASSROOM_COLOR_OPTIONS[fallbackIndex !== undefined ? fallbackIndex % CLASSROOM_COLOR_OPTIONS.length : 0];
}
