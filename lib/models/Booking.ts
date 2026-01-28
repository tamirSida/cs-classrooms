import { Timestamp } from "firebase/firestore";
import { parse, format, differenceInMinutes, isAfter, isBefore, parseISO } from "date-fns";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
}

export interface IBooking {
  id: string;
  classroomId: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  status: BookingStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
}

export interface IBookingCreate {
  classroomId: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: BookingStatus;
}

export interface IBookingUpdate {
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: BookingStatus;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  booking?: IBooking;
}

export class Booking implements IBooking {
  constructor(
    public id: string,
    public classroomId: string,
    public userId: string,
    public userEmail: string,
    public userName: string,
    public date: string,
    public startTime: string,
    public endTime: string,
    public status: BookingStatus,
    public createdAt: Timestamp,
    public updatedAt: Timestamp,
    public cancelledAt?: Timestamp,
    public cancelledBy?: string
  ) {}

  static fromFirestore(id: string, data: Omit<IBooking, "id">): Booking {
    return new Booking(
      id,
      data.classroomId,
      data.userId,
      data.userEmail,
      data.userName,
      data.date,
      data.startTime,
      data.endTime,
      data.status,
      data.createdAt,
      data.updatedAt,
      data.cancelledAt,
      data.cancelledBy
    );
  }

  toFirestore(): Omit<IBooking, "id"> {
    const data: Omit<IBooking, "id"> = {
      classroomId: this.classroomId,
      userId: this.userId,
      userEmail: this.userEmail,
      userName: this.userName,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    if (this.cancelledAt) {
      data.cancelledAt = this.cancelledAt;
    }
    if (this.cancelledBy) {
      data.cancelledBy = this.cancelledBy;
    }

    return data;
  }

  getDurationMinutes(): number {
    const start = parse(this.startTime, "HH:mm", new Date());
    const end = parse(this.endTime, "HH:mm", new Date());
    return differenceInMinutes(end, start);
  }

  isConfirmed(): boolean {
    return this.status === BookingStatus.CONFIRMED;
  }

  isPending(): boolean {
    return this.status === BookingStatus.PENDING;
  }

  isCancelled(): boolean {
    return this.status === BookingStatus.CANCELLED;
  }

  isActive(): boolean {
    return !this.isCancelled();
  }

  isOwnedBy(userId: string): boolean {
    return this.userId === userId;
  }

  getFormattedTimeRange(): string {
    return `${this.startTime} - ${this.endTime}`;
  }

  getFormattedDate(): string {
    return format(parseISO(this.date), "MMM d, yyyy");
  }

  overlaps(other: { startTime: string; endTime: string }): boolean {
    const thisStart = parse(this.startTime, "HH:mm", new Date());
    const thisEnd = parse(this.endTime, "HH:mm", new Date());
    const otherStart = parse(other.startTime, "HH:mm", new Date());
    const otherEnd = parse(other.endTime, "HH:mm", new Date());

    return isBefore(thisStart, otherEnd) && isAfter(thisEnd, otherStart);
  }
}

export class TimeSlotFactory {
  static generateSlots(
    operatingHoursStart: string,
    operatingHoursEnd: string,
    slotDuration: number = 15
  ): string[] {
    const slots: string[] = [];
    const start = parse(operatingHoursStart, "HH:mm", new Date());
    const end = parse(operatingHoursEnd, "HH:mm", new Date());

    let current = start;
    while (isBefore(current, end)) {
      slots.push(format(current, "HH:mm"));
      current = new Date(current.getTime() + slotDuration * 60000);
    }

    return slots;
  }

  static buildTimeSlotGrid(
    operatingHoursStart: string,
    operatingHoursEnd: string,
    existingBookings: IBooking[],
    slotDuration: number = 15
  ): TimeSlot[] {
    const slots = this.generateSlots(operatingHoursStart, operatingHoursEnd, slotDuration);
    const activeBookings = existingBookings.filter(
      (b) => b.status !== BookingStatus.CANCELLED
    );

    return slots.map((startTime, index) => {
      const endTime = slots[index + 1] || operatingHoursEnd;

      const overlappingBooking = activeBookings.find((booking) => {
        const bookingStart = parse(booking.startTime, "HH:mm", new Date());
        const bookingEnd = parse(booking.endTime, "HH:mm", new Date());
        const slotStart = parse(startTime, "HH:mm", new Date());

        return !isBefore(slotStart, bookingStart) && isBefore(slotStart, bookingEnd);
      });

      return {
        startTime,
        endTime,
        isAvailable: !overlappingBooking,
        booking: overlappingBooking,
      };
    });
  }
}
