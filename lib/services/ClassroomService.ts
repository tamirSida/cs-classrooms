import { Timestamp } from "firebase/firestore";
import {
  IClassroom,
  IClassroomCreate,
  IClassroomUpdate,
  IUser,
  UserRole,
  Classroom,
} from "@/lib/models";
import { classroomRepository, userRepository } from "@/lib/repositories";

export class ClassroomService {
  private static instance: ClassroomService;

  private constructor() {}

  static getInstance(): ClassroomService {
    if (!ClassroomService.instance) {
      ClassroomService.instance = new ClassroomService();
    }
    return ClassroomService.instance;
  }

  async createClassroom(data: IClassroomCreate): Promise<IClassroom> {
    return classroomRepository.create({
      ...data,
      assignedAdmins: data.assignedAdmins || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async updateClassroom(
    id: string,
    data: IClassroomUpdate
  ): Promise<IClassroom | null> {
    const existing = await classroomRepository.findById(id);
    if (!existing) {
      return null;
    }

    const updateData: Partial<IClassroom> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.color !== undefined) {
      updateData.color = data.color;
    }
    if (data.assignedAdmins !== undefined) {
      updateData.assignedAdmins = data.assignedAdmins;
    }
    if (data.config) {
      updateData.config = {
        ...existing.config,
        ...data.config,
      };
    }

    await classroomRepository.update(id, updateData);
    return classroomRepository.findById(id);
  }

  async deleteClassroom(id: string): Promise<boolean> {
    const existing = await classroomRepository.findById(id);
    if (!existing) {
      return false;
    }

    await classroomRepository.delete(id);
    return true;
  }

  async getClassroom(id: string): Promise<IClassroom | null> {
    return classroomRepository.findById(id);
  }

  async getAllClassrooms(): Promise<IClassroom[]> {
    return classroomRepository.findAll();
  }

  async getActiveClassrooms(): Promise<IClassroom[]> {
    return classroomRepository.findActiveClassrooms();
  }

  async getBookableClassrooms(): Promise<IClassroom[]> {
    return classroomRepository.findActiveClassrooms();
  }

  async getClassroomsForUser(user: IUser): Promise<IClassroom[]> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.getAllClassrooms();
    }

    // ADMIN and STUDENT both see all active classrooms
    return this.getActiveClassrooms();
  }

  async getBookableClassroomsForUser(user: IUser): Promise<IClassroom[]> {
    const classrooms = await this.getClassroomsForUser(user);
    return classrooms.filter((c) => c.config.isActive);
  }

  async toggleClassroomActive(id: string): Promise<IClassroom | null> {
    await classroomRepository.toggleActive(id);
    return classroomRepository.findById(id);
  }

  async assignAdmin(classroomId: string, adminId: string): Promise<void> {
    const admin = await userRepository.findById(adminId);
    if (!admin || admin.role === UserRole.STUDENT) {
      throw new Error("User is not an admin");
    }

    await classroomRepository.addAdmin(classroomId, adminId);

    if (!admin.assignedClassrooms.includes(classroomId)) {
      await userRepository.update(adminId, {
        assignedClassrooms: [...admin.assignedClassrooms, classroomId],
      });
    }
  }

  async removeAdmin(classroomId: string, adminId: string): Promise<void> {
    await classroomRepository.removeAdmin(classroomId, adminId);

    const admin = await userRepository.findById(adminId);
    if (admin) {
      await userRepository.update(adminId, {
        assignedClassrooms: admin.assignedClassrooms.filter((id) => id !== classroomId),
      });
    }
  }

  async getClassroomWithAdminDetails(
    id: string
  ): Promise<{ classroom: IClassroom; admins: IUser[] } | null> {
    const classroom = await classroomRepository.findById(id);
    if (!classroom) {
      return null;
    }

    const admins = await Promise.all(
      classroom.assignedAdmins.map((adminId) => userRepository.findById(adminId))
    );

    return {
      classroom,
      admins: admins.filter((a): a is IUser => a !== null),
    };
  }
}

export const classroomService = ClassroomService.getInstance();
