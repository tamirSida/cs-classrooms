import { Timestamp } from "firebase/firestore";

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  STUDENT = "student",
}

export interface IUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedClassrooms: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  isActive: boolean;
}

export interface IUserCreate {
  email: string;
  displayName: string;
  role: UserRole;
  assignedClassrooms?: string[];
  createdBy: string;
}

export interface IUserUpdate {
  displayName?: string;
  role?: UserRole;
  assignedClassrooms?: string[];
  isActive?: boolean;
}

export class User implements IUser {
  constructor(
    public id: string,
    public email: string,
    public displayName: string,
    public role: UserRole,
    public assignedClassrooms: string[],
    public createdAt: Timestamp,
    public updatedAt: Timestamp,
    public createdBy: string,
    public isActive: boolean
  ) {}

  static fromFirestore(id: string, data: Omit<IUser, "id">): User {
    return new User(
      id,
      data.email,
      data.displayName,
      data.role,
      data.assignedClassrooms || [],
      data.createdAt,
      data.updatedAt,
      data.createdBy,
      data.isActive
    );
  }

  toFirestore(): Omit<IUser, "id"> {
    return {
      email: this.email,
      displayName: this.displayName,
      role: this.role,
      assignedClassrooms: this.assignedClassrooms,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      isActive: this.isActive,
    };
  }

  isSuperAdmin(): boolean {
    return this.role === UserRole.SUPER_ADMIN;
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN;
  }

  canManageClassroom(classroomId: string): boolean {
    return this.isSuperAdmin() || this.assignedClassrooms.includes(classroomId);
  }

  getInitials(): string {
    return this.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
}
