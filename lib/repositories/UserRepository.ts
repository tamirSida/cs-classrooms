import { DocumentData } from "firebase/firestore";
import { BaseRepository } from "./BaseRepository";
import { Collections } from "@/lib/firebase";
import { User, IUser, UserRole } from "@/lib/models";

export class UserRepository extends BaseRepository<IUser> {
  private static instance: UserRepository;

  private constructor() {
    super(Collections.USERS);
  }

  static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  protected fromFirestore(id: string, data: DocumentData): IUser {
    return User.fromFirestore(id, data as Omit<IUser, "id">);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const results = await this.findWithQuery({
      filters: [{ field: "email", operator: "==", value: email }],
      limitCount: 1,
    });
    return results[0] || null;
  }

  async findByRole(role: UserRole): Promise<IUser[]> {
    return this.findWithQuery({
      filters: [{ field: "role", operator: "==", value: role }],
      orderByField: "displayName",
      sortInMemory: true,
    });
  }

  async findActiveUsers(): Promise<IUser[]> {
    return this.findWithQuery({
      filters: [{ field: "isActive", operator: "==", value: true }],
      orderByField: "displayName",
      sortInMemory: true,
    });
  }

  async findAdminsForClassroom(classroomId: string): Promise<IUser[]> {
    return this.findWithQuery({
      filters: [
        { field: "assignedClassrooms", operator: "array-contains", value: classroomId },
        { field: "isActive", operator: "==", value: true },
      ],
    });
  }

  async findSuperAdmins(): Promise<IUser[]> {
    return this.findByRole(UserRole.SUPER_ADMIN);
  }

  async findStudents(): Promise<IUser[]> {
    return this.findWithQuery({
      filters: [
        { field: "role", operator: "==", value: UserRole.STUDENT },
        { field: "isActive", operator: "==", value: true },
      ],
      orderByField: "displayName",
      sortInMemory: true,
    });
  }
}

export const userRepository = UserRepository.getInstance();
