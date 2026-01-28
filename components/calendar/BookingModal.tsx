"use client";

import { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IBooking, IClassroom, BookingStatus, TimeSlotFactory } from "@/lib/models";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Clock, Calendar, User, MapPin } from "lucide-react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: IBooking | null;
  classroom?: IClassroom | null;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
  operatingHours: { start: string; end: string };
  onSave: (data: {
    date: string;
    startTime: string;
    endTime: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => Promise<{ success: boolean; error?: string }>;
}

export function BookingModal({
  isOpen,
  onClose,
  booking,
  classroom,
  selectedDate,
  selectedStartTime,
  selectedEndTime,
  operatingHours,
  onSave,
  onCancel,
}: BookingModalProps) {
  const { user } = useAuth();
  const [startTime, setStartTime] = useState(selectedStartTime || "");
  const [endTime, setEndTime] = useState(selectedEndTime || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = TimeSlotFactory.generateSlots(
    operatingHours.start,
    operatingHours.end,
    15
  );

  useEffect(() => {
    if (booking) {
      setStartTime(booking.startTime);
      setEndTime(booking.endTime);
    } else {
      setStartTime(selectedStartTime || "");
      setEndTime(selectedEndTime || "");
    }
    setError(null);
  }, [booking, selectedStartTime, selectedEndTime, isOpen]);

  const handleSave = async () => {
    if (!startTime || !endTime) {
      setError("Please select start and end times");
      return;
    }

    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);

    if (startIndex >= endIndex) {
      setError("End time must be after start time");
      return;
    }

    setLoading(true);
    setError(null);

    const date = booking
      ? booking.date
      : format(selectedDate || new Date(), "yyyy-MM-dd");

    const result = await onSave({ date, startTime, endTime });

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Failed to save booking");
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;

    setLoading(true);
    const result = await onCancel();
    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Failed to cancel booking");
    }
  };

  const isViewMode = booking && booking.userId !== user?.id;
  const isOwnBooking = booking && booking.userId === user?.id;

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.CONFIRMED:
        return <Badge variant="success">Confirmed</Badge>;
      case BookingStatus.PENDING:
        return <Badge variant="warning">Pending Approval</Badge>;
      case BookingStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getDurationText = () => {
    if (!startTime || !endTime) return "";
    const start = parse(startTime, "HH:mm", new Date());
    const end = parse(endTime, "HH:mm", new Date());
    const minutes = (end.getTime() - start.getTime()) / 60000;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {booking ? (isViewMode ? "Booking Details" : "Edit Booking") : "New Booking"}
          </DialogTitle>
          <DialogDescription>
            {classroom?.name}
            {booking && (
              <span className="ml-2">{getStatusBadge(booking.status)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date display */}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(
                booking ? new Date(booking.date) : selectedDate || new Date(),
                "EEEE, MMMM d, yyyy"
              )}
            </span>
          </div>

          {/* Booking owner (for view mode) */}
          {booking && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{booking.userName}</span>
            </div>
          )}

          {isViewMode ? (
            /* View mode - just display times */
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {booking?.startTime} - {booking?.endTime} ({getDurationText()})
              </span>
            </div>
          ) : (
            /* Edit mode - time selection */
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                      <SelectItem value={operatingHours.end}>
                        {operatingHours.end}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {startTime && endTime && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {getDurationText()}</span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isOwnBooking && booking?.status !== BookingStatus.CANCELLED && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancel Booking
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            {!isViewMode && (
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                {loading ? "Saving..." : booking ? "Update" : "Book"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
