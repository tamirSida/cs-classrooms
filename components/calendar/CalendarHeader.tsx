"use client";

import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IClassroom } from "@/lib/models";

interface CalendarHeaderProps {
  currentDate: Date;
  view: "day" | "week";
  classrooms: IClassroom[];
  selectedClassroomId: string | null;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "day" | "week") => void;
  onClassroomChange: (classroomId: string) => void;
}

export function CalendarHeader({
  currentDate,
  view,
  classrooms,
  selectedClassroomId,
  onDateChange,
  onViewChange,
  onClassroomChange,
}: CalendarHeaderProps) {
  const handlePrevious = () => {
    if (view === "day") {
      onDateChange(subDays(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      onDateChange(addDays(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getDateRangeText = () => {
    if (view === "day") {
      return format(currentDate, "EEEE, MMMM d, yyyy");
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 6);
    if (format(weekStart, "MMM") === format(weekEnd, "MMM")) {
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "d, yyyy")}`;
    }
    return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm sm:text-base font-medium min-w-[200px]">
          {getDateRangeText()}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedClassroomId || ""} onValueChange={onClassroomChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select classroom" />
          </SelectTrigger>
          <SelectContent>
            {classrooms.map((classroom) => (
              <SelectItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-lg">
          <Button
            variant={view === "day" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("day")}
            className="rounded-r-none"
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="rounded-l-none"
          >
            Week
          </Button>
        </div>
      </div>
    </div>
  );
}
