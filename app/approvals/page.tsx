"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookings, useClassrooms } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { IBooking, UserRole } from "@/lib/models";
import { Check, X, Calendar, Clock, User, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { bookings, loading, fetchPendingBookings, approveBooking, rejectBooking } = useBookings();
  const { classrooms } = useClassrooms();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingBookings();
  }, [fetchPendingBookings]);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  if (!isAdmin) {
    return (
      <DashboardLayout title="Approvals">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground mt-2">
              You don&apos;t have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const handleApprove = async (bookingId: string) => {
    setActionLoading(bookingId);
    await approveBooking(bookingId);
    setActionLoading(null);
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    await rejectBooking(bookingId);
    setActionLoading(null);
  };

  const getClassroomName = (classroomId: string) => {
    return classrooms.find((c) => c.id === classroomId)?.name || "Unknown";
  };

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  if (loading) {
    return (
      <DashboardLayout title="Approvals">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Approvals">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Pending Approvals</h2>
            <p className="text-muted-foreground">
              Review and approve or reject booking requests
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {pendingBookings.length} pending
          </Badge>
        </div>

        {pendingBookings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Check className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All Caught Up</h3>
              <p className="text-muted-foreground mt-2">
                No pending booking requests at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingBookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {booking.userName}
                      </CardTitle>
                      <CardDescription>{booking.userEmail}</CardDescription>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{getClassroomName(booking.classroomId)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{format(parseISO(booking.date), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{booking.startTime} - {booking.endTime}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(booking.id)}
                      disabled={actionLoading === booking.id}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(booking.id)}
                      disabled={actionLoading === booking.id}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
