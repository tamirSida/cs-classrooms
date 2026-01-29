import { Timestamp } from "firebase/firestore";
import { parse, differenceInMinutes } from "date-fns";
import {
  IBooking,
  IBookingCreate,
  IBookingUpdate,
  BookingStatus,
  IClassroom,
  ISettings,
  IUser,
  ClassroomPermission,
  UserRole,
} from "@/lib/models";
import { bookingRepository, classroomRepository, settingsRepository } from "@/lib/repositories";
import { emailService } from "./EmailService";

export interface BookingValidationResult {
  valid: boolean;
  error?: string;
}

export class BookingService {
  private static instance: BookingService;

  private constructor() {}

  static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  async createBooking(
    data: IBookingCreate,
    user: IUser
  ): Promise<{ booking: IBooking; error?: string }> {
    const classroom = await classroomRepository.findById(data.classroomId);
    if (!classroom) {
      return { booking: null as unknown as IBooking, error: "Classroom not found" };
    }

    const validation = await this.validateBooking(data, classroom, user);
    if (!validation.valid) {
      return { booking: null as unknown as IBooking, error: validation.error };
    }

    // Auto-confirm for admins, otherwise check if classroom requires approval
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const status = isAdmin || !classroom.config.requiresApproval
      ? BookingStatus.CONFIRMED
      : BookingStatus.PENDING;

    const booking = await bookingRepository.create({
      ...data,
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await emailService.sendBookingConfirmation(booking, classroom.name);

    return { booking };
  }

  async modifyBooking(
    bookingId: string,
    updates: IBookingUpdate,
    user: IUser
  ): Promise<{ booking: IBooking | null; error?: string }> {
    const existing = await bookingRepository.findById(bookingId);
    if (!existing) {
      return { booking: null, error: "Booking not found" };
    }

    if (existing.userId !== user.id && user.role === UserRole.STUDENT) {
      return { booking: null, error: "Not authorized to modify this booking" };
    }

    if (existing.status === BookingStatus.CANCELLED) {
      return { booking: null, error: "Cannot modify a cancelled booking" };
    }

    const classroom = await classroomRepository.findById(existing.classroomId);
    if (!classroom) {
      return { booking: null, error: "Classroom not found" };
    }

    if (updates.startTime || updates.endTime || updates.date) {
      const newDate = updates.date || existing.date;
      const newStartTime = updates.startTime || existing.startTime;
      const newEndTime = updates.endTime || existing.endTime;

      const hasConflict = await bookingRepository.hasConflict(
        existing.classroomId,
        newDate,
        newStartTime,
        newEndTime,
        bookingId
      );

      if (hasConflict) {
        return { booking: null, error: "Time slot conflict with existing booking" };
      }
    }

    const oldDate = existing.date;
    const oldStartTime = existing.startTime;
    const oldEndTime = existing.endTime;

    await bookingRepository.update(bookingId, updates);

    const updated = await bookingRepository.findById(bookingId);

    if (updated && (updates.date || updates.startTime || updates.endTime)) {
      await emailService.sendBookingModified(
        updated,
        classroom.name,
        oldDate,
        oldStartTime,
        oldEndTime
      );
    }

    return { booking: updated };
  }

  async cancelBooking(
    bookingId: string,
    user: IUser
  ): Promise<{ success: boolean; error?: string }> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.userId !== user.id && user.role === UserRole.STUDENT) {
      return { success: false, error: "Not authorized to cancel this booking" };
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, error: "Booking is already cancelled" };
    }

    const classroom = await classroomRepository.findById(booking.classroomId);

    await bookingRepository.cancelBooking(bookingId, user.id);

    if (classroom) {
      const updatedBooking = await bookingRepository.findById(bookingId);
      if (updatedBooking) {
        await emailService.sendBookingCancelled(updatedBooking, classroom.name);
      }
    }

    return { success: true };
  }

  async approveBooking(bookingId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status !== BookingStatus.PENDING) {
      return { success: false, error: "Booking is not pending approval" };
    }

    await bookingRepository.confirmBooking(bookingId);

    const classroom = await classroomRepository.findById(booking.classroomId);
    const updatedBooking = await bookingRepository.findById(bookingId);

    if (classroom && updatedBooking) {
      await emailService.sendBookingConfirmation(updatedBooking, classroom.name);
    }

    return { success: true };
  }

  async rejectBooking(bookingId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status !== BookingStatus.PENDING) {
      return { success: false, error: "Booking is not pending approval" };
    }

    await bookingRepository.cancelBooking(bookingId, userId);

    return { success: true };
  }

  async getBookingsForClassroom(
    classroomId: string,
    startDate: string,
    endDate: string
  ): Promise<IBooking[]> {
    return bookingRepository.findByClassroomAndDateRange(classroomId, startDate, endDate);
  }

  async getAllBookingsForDateRange(
    startDate: string,
    endDate: string
  ): Promise<IBooking[]> {
    return bookingRepository.findByDateRange(startDate, endDate);
  }

  async getBookingsForUser(userId: string): Promise<IBooking[]> {
    return bookingRepository.findByUser(userId);
  }

  async getPendingBookings(classroomId?: string): Promise<IBooking[]> {
    return bookingRepository.findPendingBookings(classroomId);
  }

  private async validateBooking(
    data: IBookingCreate,
    classroom: IClassroom,
    user: IUser
  ): Promise<BookingValidationResult> {
    if (!classroom.config.isActive) {
      return { valid: false, error: "Classroom is not active" };
    }

    if (
      classroom.config.permissions === ClassroomPermission.ADMIN_ONLY &&
      user.role === UserRole.STUDENT
    ) {
      return { valid: false, error: "Students cannot book this classroom" };
    }

    const settings = await settingsRepository.getGlobalSettings();
    if (!settings) {
      return { valid: false, error: "System settings not configured" };
    }

    const startTime = parse(data.startTime, "HH:mm", new Date());
    const endTime = parse(data.endTime, "HH:mm", new Date());
    const opStart = parse(settings.operatingHours.start, "HH:mm", new Date());
    const opEnd = parse(settings.operatingHours.end, "HH:mm", new Date());

    if (startTime < opStart || endTime > opEnd) {
      return {
        valid: false,
        error: `Booking must be within operating hours (${settings.operatingHours.start} - ${settings.operatingHours.end})`,
      };
    }

    if (startTime >= endTime) {
      return { valid: false, error: "End time must be after start time" };
    }

    const hasConflict = await bookingRepository.hasConflict(
      data.classroomId,
      data.date,
      data.startTime,
      data.endTime
    );

    if (hasConflict) {
      return { valid: false, error: "Time slot is already booked" };
    }

    const maxTime =
      classroom.config.maxTimePerDay > 0
        ? classroom.config.maxTimePerDay
        : settings.defaultMaxTimePerDay;

    if (maxTime > 0) {
      const currentUsage = await bookingRepository.getUserTotalTimeForDate(
        user.id,
        data.classroomId,
        data.date
      );

      const requestedDuration = differenceInMinutes(endTime, startTime);

      if (currentUsage + requestedDuration > maxTime) {
        const remaining = maxTime - currentUsage;
        return {
          valid: false,
          error: `Daily time limit exceeded. You have ${remaining} minutes remaining for today.`,
        };
      }
    }

    return { valid: true };
  }
}

export const bookingService = BookingService.getInstance();
