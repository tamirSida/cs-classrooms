import { Timestamp } from "firebase/firestore";
import {
  IUser,
  IUserCreate,
  IUserUpdate,
  UserRole,
} from "@/lib/models";
import { userRepository } from "@/lib/repositories";

export class UserService {
  private static instance: UserService;

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async createUser(
    firebaseUid: string,
    data: IUserCreate
  ): Promise<IUser> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    return userRepository.createWithId(firebaseUid, {
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      assignedClassrooms: data.assignedClassrooms || [],
      createdBy: data.createdBy,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async updateUser(id: string, data: IUserUpdate): Promise<IUser | null> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      return null;
    }

    await userRepository.update(id, data);
    return userRepository.findById(id);
  }

  async getUser(id: string): Promise<IUser | null> {
    return userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return userRepository.findByEmail(email);
  }

  async getAllUsers(): Promise<IUser[]> {
    return userRepository.findAll();
  }

  async getActiveUsers(): Promise<IUser[]> {
    return userRepository.findActiveUsers();
  }

  async getUsersByRole(role: UserRole): Promise<IUser[]> {
    return userRepository.findByRole(role);
  }

  async getAdmins(): Promise<IUser[]> {
    const admins = await userRepository.findByRole(UserRole.ADMIN);
    const superAdmins = await userRepository.findSuperAdmins();
    return [...superAdmins, ...admins];
  }

  async getStudents(): Promise<IUser[]> {
    return userRepository.findStudents();
  }

  async deactivateUser(id: string): Promise<IUser | null> {
    return this.updateUser(id, { isActive: false });
  }

  async activateUser(id: string): Promise<IUser | null> {
    return this.updateUser(id, { isActive: true });
  }

  async changeUserRole(id: string, newRole: UserRole): Promise<IUser | null> {
    const user = await userRepository.findById(id);
    if (!user) {
      return null;
    }

    if (newRole === UserRole.STUDENT) {
      return this.updateUser(id, {
        role: newRole,
        assignedClassrooms: [],
      });
    }

    return this.updateUser(id, { role: newRole });
  }

  canUserManageUsers(user: IUser): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  canUserManageClassrooms(user: IUser): boolean {
    return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
  }
}

export const userService = UserService.getInstance();
