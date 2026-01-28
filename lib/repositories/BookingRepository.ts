import { DocumentData, Timestamp } from "firebase/firestore";
import { BaseRepository, QueryFilter } from "./BaseRepository";
import { Collections } from "@/lib/firebase";
import { Booking, IBooking, BookingStatus } from "@/lib/models";

export class BookingRepository extends BaseRepository<IBooking> {
  private static instance: BookingRepository;

  private constructor() {
    super(Collections.BOOKINGS);
  }

  static getInstance(): BookingRepository {
    if (!BookingRepository.instance) {
      BookingRepository.instance = new BookingRepository();
    }
    return BookingRepository.instance;
  }

  protected fromFirestore(id: string, data: DocumentData): IBooking {
    return Booking.fromFirestore(id, data as Omit<IBooking, "id">);
  }

  async findByClassroomAndDate(
    classroomId: string,
    date: string
  ): Promise<IBooking[]> {
    return this.findWithQuery({
      filters: [
        { field: "classroomId", operator: "==", value: classroomId },
        { field: "date", operator: "==", value: date },
      ],
      orderByField: "startTime",
      sortInMemory: true,
    });
  }

  async findByClassroomAndDateRange(
    classroomId: string,
    startDate: string,
    endDate: string
  ): Promise<IBooking[]> {
    return this.findWithQuery({
      filters: [
        { field: "classroomId", operator: "==", value: classroomId },
        { field: "date", operator: ">=", value: startDate },
        { field: "date", operator: "<=", value: endDate },
      ],
      orderByField: "date",
      sortInMemory: true,
    });
  }

  async findByUser(userId: string): Promise<IBooking[]> {
    return this.findWithQuery({
      filters: [{ field: "userId", operator: "==", value: userId }],
      orderByField: "date",
      sortInMemory: true,
    });
  }

  async findByUserAndDate(userId: string, date: string): Promise<IBooking[]> {
    return this.findWithQuery({
      filters: [
        { field: "userId", operator: "==", value: userId },
        { field: "date", operator: "==", value: date },
      ],
      orderByField: "startTime",
      sortInMemory: true,
    });
  }

  async findActiveByClassroomAndDate(
    classroomId: string,
    date: string
  ): Promise<IBooking[]> {
    const bookings = await this.findByClassroomAndDate(classroomId, date);
    return bookings.filter((b) => b.status !== BookingStatus.CANCELLED);
  }

  async findPendingBookings(classroomId?: string): Promise<IBooking[]> {
    const filters: QueryFilter[] = [
      { field: "status", operator: "==", value: BookingStatus.PENDING },
    ];

    if (classroomId) {
      filters.push({ field: "classroomId", operator: "==", value: classroomId });
    }

    return this.findWithQuery({
      filters,
      orderByField: "createdAt",
      sortInMemory: true,
    });
  }

  async cancelBooking(
    bookingId: string,
    cancelledBy: string
  ): Promise<void> {
    await this.update(bookingId, {
      status: BookingStatus.CANCELLED,
      cancelledAt: Timestamp.now(),
      cancelledBy,
    });
  }

  async confirmBooking(bookingId: string): Promise<void> {
    await this.update(bookingId, {
      status: BookingStatus.CONFIRMED,
    });
  }

  async getUserTotalTimeForDate(
    userId: string,
    classroomId: string,
    date: string
  ): Promise<number> {
    const bookings = await this.findWithQuery({
      filters: [
        { field: "userId", operator: "==", value: userId },
        { field: "classroomId", operator: "==", value: classroomId },
        { field: "date", operator: "==", value: date },
      ],
    });

    const activeBookings = bookings.filter(
      (b) => b.status !== BookingStatus.CANCELLED
    );

    return activeBookings.reduce((total, booking) => {
      const b = new Booking(
        booking.id,
        booking.classroomId,
        booking.userId,
        booking.userEmail,
        booking.userName,
        booking.date,
        booking.startTime,
        booking.endTime,
        booking.status,
        booking.createdAt,
        booking.updatedAt
      );
      return total + b.getDurationMinutes();
    }, 0);
  }

  async hasConflict(
    classroomId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const bookings = await this.findActiveByClassroomAndDate(classroomId, date);

    const bookingObj = new Booking(
      "",
      classroomId,
      "",
      "",
      "",
      date,
      startTime,
      endTime,
      BookingStatus.PENDING,
      Timestamp.now(),
      Timestamp.now()
    );

    return bookings.some((existing) => {
      if (excludeBookingId && existing.id === excludeBookingId) {
        return false;
      }
      const existingBooking = new Booking(
        existing.id,
        existing.classroomId,
        existing.userId,
        existing.userEmail,
        existing.userName,
        existing.date,
        existing.startTime,
        existing.endTime,
        existing.status,
        existing.createdAt,
        existing.updatedAt
      );
      return bookingObj.overlaps(existingBooking);
    });
  }
}

export const bookingRepository = BookingRepository.getInstance();
