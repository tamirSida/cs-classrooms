"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  IBooking,
  IClassroom,
  BookingStatus,
  TimeSlotFactory,
  SeriesCancelResult,
  SeriesDateEntry,
  SeriesInput,
} from "@/lib/models";
import { RecurrenceRule } from "@/lib/recurrence";
import { hasStarted, nowInCampus } from "@/lib/time";
import { useAuth } from "@/contexts/AuthContext";
import { useSeriesPreview, useSeriesSummary } from "@/hooks/useBookingSeries";
import { CancelScopeDialog } from "@/components/bookings/CancelScopeDialog";
import { RepeatIcon } from "@/components/icons";
import {
  defaultRepeatSettings,
  RepeatSection,
  RepeatSettings,
  SeriesDateList,
  toRecurrenceRule,
} from "./RepeatSection";
import { Trash2, Clock, Calendar, User } from "lucide-react";

export interface BookingSaveData {
  date: string;
  startTime: string;
  endTime: string;
  recurrence?: { rule: RecurrenceRule; skipDates: string[] };
}

export interface BookingSaveResult {
  success: boolean;
  error?: string;
  preview?: SeriesDateEntry[];
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: IBooking | null;
  classroom?: IClassroom | null;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
  operatingHours: { start: string; end: string };
  onSave: (data: BookingSaveData) => Promise<BookingSaveResult>;
  onCancel?: () => Promise<{ success: boolean; error?: string }>;
  onSeriesChanged?: (result: SeriesCancelResult) => void;
  canOverride?: boolean; // True if the current user may edit/cancel bookings they don't own.
  canRecur?: boolean; // True if the current user may create recurring bookings.
}

const toDateString = (date: Date) => format(date, "yyyy-MM-dd");

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
  onSeriesChanged,
  canOverride = false,
  canRecur = false,
}: BookingModalProps) {
  const { user } = useAuth();
  const [startTime, setStartTime] = useState(selectedStartTime || "");
  const [endTime, setEndTime] = useState(selectedEndTime || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeat, setRepeat] = useState<RepeatSettings | null>(null);
  const [conflict, setConflict] = useState<{ key: string; entries: SeriesDateEntry[] } | null>(null);
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false);

  const timeSlots = TimeSlotFactory.generateSlots(operatingHours.start, operatingHours.end, 15);
  const startDate = toDateString(selectedDate || new Date());

  useEffect(() => {
    if (booking) {
      setStartTime(booking.startTime);
      setEndTime(booking.endTime);
    } else {
      setStartTime(selectedStartTime || "");
      setEndTime(selectedEndTime || "");
    }
    setError(null);
    setRepeatOn(false);
    setRepeat(null);
  }, [booking, selectedStartTime, selectedEndTime, isOpen]);

  const seriesInput = useMemo<SeriesInput | null>(() => {
    if (!repeatOn || !repeat || booking || !classroom || !startTime || !endTime || startTime >= endTime) {
      return null;
    }
    return { classroomId: classroom.id, startDate, startTime, endTime, rule: toRecurrenceRule(repeat) };
  }, [repeatOn, repeat, booking, classroom, startDate, startTime, endTime]);

  const preview = useSeriesPreview(seriesInput);
  const seriesKey = seriesInput ? JSON.stringify(seriesInput) : null;

  // A 409 list is only valid for the inputs it was returned for.
  const conflictEntries = conflict && conflict.key === seriesKey ? conflict.entries : null;
  const entries = conflictEntries ?? preview.preview?.entries ?? [];
  const bookableCount = entries.filter((e) => e.status === "available").length;
  const skippedCount = entries.length - bookableCount;
  const previewReady = !!seriesInput && !preview.loading && !preview.error && entries.length > 0;

  const summary = useSeriesSummary(booking?.seriesId);
  const seriesStarted = !!booking?.seriesId && hasStarted(booking, nowInCampus());

  const toggleRepeat = (on: boolean) => {
    setRepeatOn(on);
    if (on && !repeat) setRepeat(defaultRepeatSettings(startDate));
  };

  const handleSave = async () => {
    if (!startTime || !endTime) {
      setError("Please select start and end times");
      return;
    }

    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }

    if (seriesInput && (!previewReady || bookableCount === 0)) return;

    setLoading(true);
    setError(null);

    const date = booking ? booking.date : startDate;
    const recurrence = seriesInput
      ? {
          rule: seriesInput.rule,
          skipDates: entries.filter((e) => e.status !== "available").map((e) => e.date),
        }
      : undefined;

    const result = await onSave({ date, startTime, endTime, recurrence });

    setLoading(false);

    if (result.success) {
      onClose();
    } else if (result.preview && seriesKey) {
      setConflict({ key: seriesKey, entries: result.preview });
      setError("Some dates were just taken. Review the updated list and confirm again.");
    } else {
      setError(result.error || "Failed to save booking");
    }
  };

  const handleCancel = async () => {
    if (booking?.seriesId) {
      setCancelScopeOpen(true);
      return;
    }
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

  const handleSeriesCancelled = (result: SeriesCancelResult) => {
    setCancelScopeOpen(false);
    onSeriesChanged?.(result);
    onClose();
  };

  const canManage = !!booking && (booking.userId === user?.id || canOverride);
  const isViewMode = !!booking && (!canManage || seriesStarted);

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

  const saveLabel = () => {
    if (loading) return "Saving...";
    if (booking) return "Update";
    if (!seriesInput) return "Book";
    if (preview.loading || !previewReady) return "Checking dates...";
    if (bookableCount === 0) return "No dates available";
    return skippedCount > 0
      ? `Book ${bookableCount} dates, skip ${skippedCount}`
      : `Book ${bookableCount} dates`;
  };

  const displayDate = booking ? parse(booking.date, "yyyy-MM-dd", new Date()) : selectedDate || new Date();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {booking ? (isViewMode ? "Booking Details" : "Edit Booking") : "New Booking"}
            </DialogTitle>
            <DialogDescription>
              {classroom?.name}
              {booking && <span className="ml-2">{getStatusBadge(booking.status)}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(displayDate, "EEEE, MMMM d, yyyy")}</span>
            </div>

            {booking && (
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{booking.userName}</span>
              </div>
            )}

            {booking?.seriesId && (
              <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <RepeatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{summary ? summary.ruleText : "Recurring booking"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {seriesStarted
                    ? "This date has started and can't be changed."
                    : "Changes to the time apply to this date only."}
                </p>
              </div>
            )}

            {isViewMode ? (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {booking?.startTime} - {booking?.endTime} ({getDurationText()})
                </span>
              </div>
            ) : (
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
                        <SelectItem value={operatingHours.end}>{operatingHours.end}</SelectItem>
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

                {!booking && canRecur && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="repeat-toggle" className="flex items-center gap-2">
                        <RepeatIcon className="h-3.5 w-3.5" />
                        Repeat
                      </Label>
                      <Switch id="repeat-toggle" checked={repeatOn} onCheckedChange={toggleRepeat} />
                    </div>
                    {repeatOn && repeat && (
                      <>
                        <RepeatSection
                          startDate={startDate}
                          value={repeat}
                          onChange={setRepeat}
                          firstDate={entries[0]?.date}
                        />
                        {preview.error && (
                          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            {preview.error}
                          </div>
                        )}
                        {entries.length > 0 && <SeriesDateList entries={entries} />}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canManage && !seriesStarted && booking?.status !== BookingStatus.CANCELLED && (
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
                <Button
                  onClick={handleSave}
                  disabled={loading || (!!seriesInput && (!previewReady || bookableCount === 0))}
                  className="flex-1"
                >
                  {saveLabel()}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancelScopeDialog
        booking={booking?.seriesId ? booking : null}
        open={cancelScopeOpen}
        onOpenChange={setCancelScopeOpen}
        onDone={handleSeriesCancelled}
      />
    </>
  );
}
