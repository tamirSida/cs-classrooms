"use client";

import { useState, useEffect } from "react";
import { format, parse, addMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IClassroom, IBooking, BookingStatus } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Check, X, Clock, Building2, Search } from "lucide-react";

interface FindClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  classrooms: IClassroom[];
  bookings: IBooking[];
  operatingHours: { start: string; end: string };
  onSelectClassroom: (classroomId: string, date: Date, startTime: string, endTime: string) => void;
}

export function FindClassroomModal({
  isOpen,
  onClose,
  classrooms,
  bookings,
  operatingHours,
  onSelectClassroom,
}: FindClassroomModalProps) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60); // minutes
  const [searched, setSearched] = useState(false);
  const [availableClassrooms, setAvailableClassrooms] = useState<IClassroom[]>([]);
  const [unavailableClassrooms, setUnavailableClassrooms] = useState<{ classroom: IClassroom; reason: string }[]>([]);

  // Set default start time to next hour
  useEffect(() => {
    if (isOpen && !startTime) {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setStartTime(format(nextHour, "HH:mm"));
    }
  }, [isOpen, startTime]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearched(false);
      setAvailableClassrooms([]);
      setUnavailableClassrooms([]);
    }
  }, [isOpen]);

  const calculateEndTime = () => {
    if (!startTime) return "";
    const start = parse(startTime, "HH:mm", new Date());
    const end = addMinutes(start, duration);
    return format(end, "HH:mm");
  };

  const isWithinOperatingHours = (start: string, end: string) => {
    const opStart = parse(operatingHours.start, "HH:mm", new Date());
    const opEnd = parse(operatingHours.end, "HH:mm", new Date());
    const reqStart = parse(start, "HH:mm", new Date());
    const reqEnd = parse(end, "HH:mm", new Date());

    return reqStart >= opStart && reqEnd <= opEnd;
  };

  const hasConflict = (classroomId: string, requestedDate: string, requestedStart: string, requestedEnd: string) => {
    const classroomBookings = bookings.filter(
      (b) =>
        b.classroomId === classroomId &&
        b.date === requestedDate &&
        b.status !== BookingStatus.CANCELLED
    );

    const reqStart = parse(requestedStart, "HH:mm", new Date());
    const reqEnd = parse(requestedEnd, "HH:mm", new Date());

    for (const booking of classroomBookings) {
      const bookStart = parse(booking.startTime, "HH:mm", new Date());
      const bookEnd = parse(booking.endTime, "HH:mm", new Date());

      // Check for overlap
      if (reqStart < bookEnd && reqEnd > bookStart) {
        return booking;
      }
    }

    return null;
  };

  const handleSearch = () => {
    const endTime = calculateEndTime();

    if (!isWithinOperatingHours(startTime, endTime)) {
      alert(`Time must be within operating hours (${operatingHours.start} - ${operatingHours.end})`);
      return;
    }

    const available: IClassroom[] = [];
    const unavailable: { classroom: IClassroom; reason: string }[] = [];

    for (const classroom of classrooms) {
      if (!classroom.config.isActive) {
        unavailable.push({ classroom, reason: "Classroom is inactive" });
        continue;
      }

      const conflict = hasConflict(classroom.id, date, startTime, endTime);
      if (conflict) {
        unavailable.push({
          classroom,
          reason: `Booked by ${conflict.userName} (${conflict.startTime}-${conflict.endTime})`,
        });
      } else {
        available.push(classroom);
      }
    }

    setAvailableClassrooms(available);
    setUnavailableClassrooms(unavailable);
    setSearched(true);
  };

  const handleSelect = (classroomId: string) => {
    const selectedDate = parse(date, "yyyy-MM-dd", new Date());
    onSelectClassroom(classroomId, selectedDate, startTime, calculateEndTime());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Available Classroom
          </DialogTitle>
          <DialogDescription>
            Enter your preferred date and time to see which classrooms are available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSearched(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setSearched(false);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => {
                  setDuration(parseInt(e.target.value) || 15);
                  setSearched(false);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
              {startTime && (
                <span className="text-sm text-muted-foreground ml-auto">
                  Until {calculateEndTime()}
                </span>
              )}
            </div>
          </div>

          <Button onClick={handleSearch} className="w-full">
            <Search className="h-4 w-4 mr-2" />
            Search Available Classrooms
          </Button>

          {/* Results */}
          {searched && (
            <div className="space-y-4 mt-4">
              {/* Available classrooms */}
              {availableClassrooms.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    Available ({availableClassrooms.length})
                  </h4>
                  <div className="space-y-2">
                    {availableClassrooms.map((classroom) => (
                      <Card
                        key={classroom.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleSelect(classroom.id)}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{classroom.name}</span>
                            {classroom.description && (
                              <span className="text-sm text-muted-foreground">
                                - {classroom.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {classroom.config.requiresApproval && (
                              <Badge variant="warning">Requires Approval</Badge>
                            )}
                            <Button size="sm">Book</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Unavailable classrooms */}
              {unavailableClassrooms.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
                    <X className="h-4 w-4" />
                    Unavailable ({unavailableClassrooms.length})
                  </h4>
                  <div className="space-y-2">
                    {unavailableClassrooms.map(({ classroom, reason }) => (
                      <Card key={classroom.id} className="bg-muted/50">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">
                              {classroom.name}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">{reason}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {availableClassrooms.length === 0 && unavailableClassrooms.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No classrooms found.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
