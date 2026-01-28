import { DocumentData } from "firebase/firestore";
import { BaseRepository } from "./BaseRepository";
import { Collections } from "@/lib/firebase";
import { Classroom, IClassroom, ClassroomPermission } from "@/lib/models";

export class ClassroomRepository extends BaseRepository<IClassroom> {
  private static instance: ClassroomRepository;

  private constructor() {
    super(Collections.CLASSROOMS);
  }

  static getInstance(): ClassroomRepository {
    if (!ClassroomRepository.instance) {
      ClassroomRepository.instance = new ClassroomRepository();
    }
    return ClassroomRepository.instance;
  }

  protected fromFirestore(id: string, data: DocumentData): IClassroom {
    return Classroom.fromFirestore(id, data as Omit<IClassroom, "id">);
  }

  async findActiveClassrooms(): Promise<IClassroom[]> {
    return this.findWithQuery({
      filters: [{ field: "config.isActive", operator: "==", value: true }],
      orderByField: "name",
      sortInMemory: true,
    });
  }

  async findStudentBookableClassrooms(): Promise<IClassroom[]> {
    const all = await this.findAll();
    return all.filter(
      (c) =>
        c.config.isActive && c.config.permissions === ClassroomPermission.STUDENT
    );
  }

  async findByAdmin(adminId: string): Promise<IClassroom[]> {
    return this.findWithQuery({
      filters: [{ field: "assignedAdmins", operator: "array-contains", value: adminId }],
      orderByField: "name",
      sortInMemory: true,
    });
  }

  async addAdmin(classroomId: string, adminId: string): Promise<void> {
    const classroom = await this.findById(classroomId);
    if (!classroom) {
      throw new Error("Classroom not found");
    }

    if (!classroom.assignedAdmins.includes(adminId)) {
      await this.update(classroomId, {
        assignedAdmins: [...classroom.assignedAdmins, adminId],
      });
    }
  }

  async removeAdmin(classroomId: string, adminId: string): Promise<void> {
    const classroom = await this.findById(classroomId);
    if (!classroom) {
      throw new Error("Classroom not found");
    }

    await this.update(classroomId, {
      assignedAdmins: classroom.assignedAdmins.filter((id) => id !== adminId),
    });
  }

  async toggleActive(classroomId: string): Promise<void> {
    const classroom = await this.findById(classroomId);
    if (!classroom) {
      throw new Error("Classroom not found");
    }

    await this.update(classroomId, {
      config: {
        ...classroom.config,
        isActive: !classroom.config.isActive,
      },
    });
  }
}

export const classroomRepository = ClassroomRepository.getInstance();
