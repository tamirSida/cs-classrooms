"use client";

import { DashboardLayout } from "@/components/layout";
import { CalendarView } from "@/components/calendar";

export default function CalendarPage() {
  return (
    <DashboardLayout title="Calendar">
      <CalendarView />
    </DashboardLayout>
  );
}
