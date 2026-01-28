"use client";

import { DashboardLayout } from "@/components/layout";
import { MyBookingsView } from "@/components/bookings/MyBookingsView";

export default function MyBookingsPage() {
  return (
    <DashboardLayout title="My Bookings">
      <MyBookingsView />
    </DashboardLayout>
  );
}
