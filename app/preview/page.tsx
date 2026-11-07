"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, parse } from "date-fns";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { TimeSlotFactory } from "@/lib/models";
import { hasStarted, nowInCampus } from "@/lib/time";
import { PreviewBooking, PreviewView, usePreviewData } from "@/hooks/usePreviewData";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Calendar, RefreshCw, ChevronLeft, ChevronRight, Settings2, X, Map as MapIcon } from "lucide-react";

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
  const [qr, setQr] = useState<{ code: string; url: string } | null>(null);

  // Display settings
  const [view, setView] = useState<PreviewView>("week");
  // null until the viewer changes the filter: then all classrooms (including new ones) show.
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showMap, setShowMap] = useState(false);

  const {
    classrooms,
    settings,
    bookings,
    loading,
    rangeLoaded,
    firstLoadFailed,
    failing,
    stale,
    lastSuccessAt,
    campusNow,
    anchor,
    navigate,
    goToToday,
    refresh,
  } = usePreviewData(view, autoRefresh);

  const currentDate = useMemo(() => parse(anchor, "yyyy-MM-dd", new Date()), [anchor]);
  const selectedClassrooms = useMemo(
    () => selection ?? new Set(classrooms.map((c) => c.id)),
    [selection, classrooms]
  );
  const isCampusToday = (day: Date) => format(day, "yyyy-MM-dd") === campusNow.date;

  const timeSlots = useMemo(() => {
    if (!settings) return [];
    return TimeSlotFactory.generateSlots(
      settings.operatingHours.start,
      settings.operatingHours.end,
      15
    );
  }, [settings]);

  // Generate QR code for signup page
  const signupCode = settings?.signupCode;
  useEffect(() => {
    if (!signupCode) return;

    const signupUrl = `${window.location.origin}/join/${signupCode}`;

    QRCode.toDataURL(signupUrl, {
      width: 120,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => setQr({ code: signupCode, url })).catch(console.error);
  }, [signupCode]);
  const qrCodeUrl = signupCode && qr?.code === signupCode ? qr.url : null;


  const days = useMemo(() => {
    if (view === "day") {
      return [currentDate];
    }
    return Array.from({ length: 4 }, (_, i) => addDays(currentDate, i));
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

  const getBookingStyle = (booking: PreviewBooking) => {
    const startSlotIndex = timeSlots.findIndex((t) => t === booking.startTime);
    // endTime can equal operatingHours.end, which isn't in timeSlots — treat as one past last.
    const rawEndIndex = timeSlots.findIndex((t) => t === booking.endTime);
    const endSlotIndex = rawEndIndex === -1 ? timeSlots.length : rawEndIndex;
    const slotCount = endSlotIndex - startSlotIndex;
    const totalSlots = timeSlots.length;

    return {
      top: `${(startSlotIndex / totalSlots) * 100}%`,
      height: `calc(${(slotCount / totalSlots) * 100}% - 2px)`,
    };
  };

  const isSlotInPast = (date: Date, time: string) =>
    hasStarted({ date: format(date, "yyyy-MM-dd"), startTime: time }, campusNow);

  const toggleClassroom = (classroomId: string) => {
    setSelection(() => {
      const next = new Set(selectedClassrooms);
      if (next.has(classroomId)) {
        next.delete(classroomId);
      } else {
        next.add(classroomId);
      }
      return next;
    });
  };

  const selectAllClassrooms = () => {
    setSelection(null);
  };

  const deselectAllClassrooms = () => {
    setSelection(new Set());
  };

  const navigateDate = (direction: "prev" | "next") => navigate(direction === "next" ? 1 : -1);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        {firstLoadFailed && (
          <p className="mb-4 text-sm text-destructive">Can&apos;t reach the server. Retrying automatically.</p>
        )}
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
                4 Days
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
                  : `${format(currentDate, "MMM d")} – ${format(addDays(currentDate, 3), "MMM d")}`}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              title={stale ? "Can't reach the server. Retrying automatically." : "Refresh now"}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", stale && "text-destructive")} />
              <span className={cn("text-xs", stale ? "text-destructive" : "text-muted-foreground")}>
                {lastSuccessAt ? nowInCampus(new Date(lastSuccessAt)).time : "--:--"}
                {stale && ", reconnecting"}
              </span>
            </Button>

            {/* Map toggle */}
            <Button
              variant={showMap ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowMap((v) => !v)}
            >
              <MapIcon className="h-4 w-4 mr-2" />
              {showMap ? "Schedule" : "Map"}
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
      {!showMap && (
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
      )}

      {/* Main content: calendar grid or map */}
      <div className="flex-1 overflow-hidden p-4 relative">
        {showMap ? (
          <div className="h-full flex items-center justify-center">
            <img
              src="/map.jpeg"
              alt="Classroom map"
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          </div>
        ) : (
          <>
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
          <div className="h-full flex flex-col relative">
            {!rangeLoaded && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70">
                <span className="text-sm text-muted-foreground">
                  {failing ? "Can't reach the server. Retrying..." : "Loading schedule..."}
                </span>
              </div>
            )}
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
                    isCampusToday(day) && "bg-primary/5"
                  )}
                >
                  <div className="p-2 text-center border-b">
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        isCampusToday(day) && "text-primary"
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
              className="flex-1 grid min-h-0 pt-2"
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
                    isCampusToday(day) && "bg-primary/5"
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
          </>
        )}
      </div>

      {/* Footer with current time */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>Public Preview - Read Only</span>
        <span>
          {format(parse(campusNow.date, "yyyy-MM-dd", new Date()), "EEEE, MMMM d, yyyy")} · {campusNow.time}
        </span>
      </div>
    </div>
  );
}
