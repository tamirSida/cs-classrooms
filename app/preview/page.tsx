"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isToday,
  parse,
  isBefore,
} from "date-fns";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { IBooking, IClassroom, ISettings, TimeSlotFactory } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Calendar, RefreshCw, ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";

// Classroom colors
const CLASSROOM_COLORS = [
  { bg: "bg-blue-500", text: "text-white", light: "bg-blue-100" },
  { bg: "bg-emerald-500", text: "text-white", light: "bg-emerald-100" },
  { bg: "bg-purple-500", text: "text-white", light: "bg-purple-100" },
  { bg: "bg-orange-500", text: "text-white", light: "bg-orange-100" },
  { bg: "bg-pink-500", text: "text-white", light: "bg-pink-100" },
  { bg: "bg-cyan-500", text: "text-white", light: "bg-cyan-100" },
  { bg: "bg-amber-500", text: "text-white", light: "bg-amber-100" },
  { bg: "bg-indigo-500", text: "text-white", light: "bg-indigo-100" },
];

export default function PreviewPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [classrooms, setClassrooms] = useState<IClassroom[]>([]);
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Display settings
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedClassrooms, setSelectedClassrooms] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Load all data from API
  const loadData = useCallback(async () => {
    const start = view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

    const end = view === "day"
      ? format(currentDate, "yyyy-MM-dd")
      : format(endOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

    try {
      const response = await fetch(`/api/preview?startDate=${start}&endDate=${end}`);
      if (!response.ok) throw new Error("Failed to fetch data");

      const data = await response.json();

      setClassrooms(data.classrooms);
      setSettings(data.settings);
      setBookings(data.bookings);

      // On first load, select all classrooms
      if (selectedClassrooms.size === 0 && data.classrooms.length > 0) {
        setSelectedClassrooms(new Set(data.classrooms.map((c: IClassroom) => c.id)));
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, view, selectedClassrooms.size]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Alias for refresh button
  const loadBookings = loadData;

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadBookings();
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadBookings]);

  const timeSlots = useMemo(() => {
    if (!settings) return [];
    return TimeSlotFactory.generateSlots(
      settings.operatingHours.start,
      settings.operatingHours.end,
      15
    );
  }, [settings]);

  // Generate QR code for signup page
  useEffect(() => {
    const signupUrl = settings?.signupCode
      ? `${window.location.origin}/signup?code=${settings.signupCode}`
      : `${window.location.origin}/signup`;

    QRCode.toDataURL(signupUrl, {
      width: 120,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrCodeUrl).catch(console.error);
  }, [settings?.signupCode]);


  const days = useMemo(() => {
    if (view === "day") {
      return [currentDate];
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, view]);

  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((c) => selectedClassrooms.has(c.id));
  }, [classrooms, selectedClassrooms]);

  const classroomColorMap = useMemo(() => {
    const map = new Map<string, (typeof CLASSROOM_COLORS)[0]>();
    classrooms.forEach((classroom, index) => {
      map.set(classroom.id, CLASSROOM_COLORS[index % CLASSROOM_COLORS.length]);
    });
    return map;
  }, [classrooms]);

  const getBookingsForDayAndClassroom = (date: Date, classroomId: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.filter(
      (b) => b.date === dateStr && b.classroomId === classroomId
    );
  };

  const getBookingStyle = (booking: IBooking) => {
    const startSlotIndex = timeSlots.findIndex((t) => t === booking.startTime);
    const endSlotIndex = timeSlots.findIndex((t) => t === booking.endTime);
    const slotCount = endSlotIndex - startSlotIndex;
    const totalSlots = timeSlots.length;

    return {
      top: `${(startSlotIndex / totalSlots) * 100}%`,
      height: `calc(${(slotCount / totalSlots) * 100}% - 2px)`,
    };
  };

  const isSlotInPast = (date: Date, time: string) => {
    const slotDateTime = parse(time, "HH:mm", date);
    return isBefore(slotDateTime, new Date());
  };

  const toggleClassroom = (classroomId: string) => {
    setSelectedClassrooms((prev) => {
      const next = new Set(prev);
      if (next.has(classroomId)) {
        next.delete(classroomId);
      } else {
        next.add(classroomId);
      }
      return next;
    });
  };

  const selectAllClassrooms = () => {
    setSelectedClassrooms(new Set(classrooms.map((c) => c.id)));
  };

  const deselectAllClassrooms = () => {
    setSelectedClassrooms(new Set());
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const navigateDate = (direction: "prev" | "next") => {
    const days = view === "day" ? 1 : 7;
    setCurrentDate((prev) =>
      direction === "next" ? addDays(prev, days) : addDays(prev, -days)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[calc(100vh-8rem)] w-full" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Classroom Schedule</h1>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button
                variant={view === "day" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("day")}
              >
                Today
              </Button>
              <Button
                variant={view === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("week")}
              >
                Week
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                <Calendar className="h-4 w-4 mr-2" />
                {view === "day"
                  ? format(currentDate, "EEEE, MMM d")
                  : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")}`}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Refresh */}
            <Button variant="ghost" size="sm" onClick={loadBookings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="text-xs text-muted-foreground">
                {format(lastRefresh, "HH:mm")}
              </span>
            </Button>

            {/* Settings toggle */}
            <Button
              variant={showSettings ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <Card className="mt-3">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Auto-refresh</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={autoRefresh}
                      onCheckedChange={setAutoRefresh}
                    />
                    <span className="text-sm text-muted-foreground">
                      {autoRefresh ? "Every minute" : "Off"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Show QR</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showQr}
                      onCheckedChange={setShowQr}
                    />
                    <span className="text-sm text-muted-foreground">
                      {showQr ? "Visible" : "Hidden"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Classrooms</Label>
                    <div className="flex gap-2">
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAllClassrooms}>
                        All
                      </Button>
                      <span className="text-muted-foreground">/</span>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={deselectAllClassrooms}>
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {classrooms.map((classroom, index) => {
                      const color = CLASSROOM_COLORS[index % CLASSROOM_COLORS.length];
                      const isSelected = selectedClassrooms.has(classroom.id);

                      return (
                        <Button
                          key={classroom.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 text-xs",
                            isSelected && color.bg,
                            isSelected && color.text
                          )}
                          onClick={() => toggleClassroom(classroom.id)}
                        >
                          {classroom.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Color legend */}
      <div className="px-4 py-2 bg-muted/30 border-b flex flex-wrap gap-4">
        {filteredClassrooms.map((classroom, index) => {
          const color = classroomColorMap.get(classroom.id)!;
          return (
            <div key={classroom.id} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded", color.bg)} />
              <span className="text-xs font-medium">{classroom.name}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden p-4 relative">
        {/* QR Code overlay */}
        {showQr && qrCodeUrl && (
          <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded-lg shadow-lg">
            <img src={qrCodeUrl} alt="Signup QR Code" className="w-24 h-24" />
            <p className="text-[10px] text-center text-muted-foreground mt-1">Scan to sign up</p>
          </div>
        )}

        {filteredClassrooms.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-lg font-semibold">No Classrooms Selected</h3>
              <p className="text-muted-foreground mt-2">
                Open settings to select which classrooms to display.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Headers */}
            <div
              className="z-10 bg-background border-b grid shrink-0"
              style={{
                gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
              }}
            >
              <div className="border-r p-2" />
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <div className="p-2 text-center border-b">
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        isToday(day) && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                  {/* Classroom sub-headers */}
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${filteredClassrooms.length}, 1fr)` }}
                  >
                    {filteredClassrooms.map((classroom) => {
                      const color = classroomColorMap.get(classroom.id)!;
                      return (
                        <div
                          key={classroom.id}
                          className={cn(
                            "p-1 text-center text-[10px] font-medium border-r last:border-r-0 truncate",
                            color.light
                          )}
                          title={classroom.name}
                        >
                          {classroom.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div
              className="flex-1 grid min-h-0"
              style={{
                gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
              }}
            >
              {/* Time labels */}
              <div className="border-r flex flex-col">
                {timeSlots.map((time, index) => (
                  <div
                    key={time}
                    className="flex-1 border-b text-xs text-muted-foreground pr-2 text-right flex items-start justify-end"
                  >
                    {index % 4 === 0 && (
                      <span className="-mt-1">{time}</span>
                    )}
                  </div>
                ))}
                {/* End time label */}
                <div className="h-0 text-xs text-muted-foreground pr-2 text-right flex items-start justify-end">
                  <span className="-mt-1">{settings?.operatingHours.end}</span>
                </div>
              </div>

              {/* Day columns */}
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r grid",
                    isToday(day) && "bg-primary/5"
                  )}
                  style={{ gridTemplateColumns: `repeat(${filteredClassrooms.length}, 1fr)` }}
                >
                  {filteredClassrooms.map((classroom, idx) => {
                    const dayBookings = getBookingsForDayAndClassroom(day, classroom.id);
                    const color = classroomColorMap.get(classroom.id)!;

                    return (
                      <div key={classroom.id} className="relative border-r last:border-r-0 flex flex-col">
                        {/* Time slots */}
                        {timeSlots.map((time) => {
                          const isPast = isSlotInPast(day, time);

                          return (
                            <div
                              key={time}
                              className={cn(
                                "flex-1 border-b",
                                isPast && "bg-muted/50",
                                idx % 2 === 1 && "bg-muted/20"
                              )}
                            />
                          );
                        })}

                        {/* Bookings */}
                        {dayBookings.map((booking) => {
                          const style = getBookingStyle(booking);

                          return (
                            <div
                              key={booking.id}
                              className={cn(
                                "absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] overflow-hidden",
                                color.bg,
                                color.text
                              )}
                              style={style}
                              title={`${booking.userName}: ${booking.startTime} - ${booking.endTime}`}
                            >
                              <div className="font-medium truncate">{booking.userName}</div>
                              <div className="truncate opacity-80">
                                {booking.startTime}-{booking.endTime}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with current time */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>Public Preview - Read Only</span>
        <span>{format(new Date(), "EEEE, MMMM d, yyyy · HH:mm")}</span>
      </div>
    </div>
  );
}
