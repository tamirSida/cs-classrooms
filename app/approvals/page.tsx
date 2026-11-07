"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchSeriesSummaries, useBookings, useClassrooms } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { BookingSeriesSummary, BookingStatus, IBooking, UserRole } from "@/lib/models";
import { formatDateLabel } from "@/lib/recurrence";
import { hasStarted, nowInCampus } from "@/lib/time";
import { RepeatIcon } from "@/components/icons";
import { Check, X, Calendar, Clock, User, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type ApprovalCard =
  | { kind: "single"; key: string; booking: IBooking; upcoming: IBooking[] }
  | { kind: "series"; key: string; seriesId: string; bookings: IBooking[]; upcoming: IBooking[] };

// Groups pending bookings into cards: one per series, one per single booking.
// Dates that have already started are "lapsed": they can be rejected (cleared) but not approved.
function buildCards(bookings: IBooking[]): ApprovalCard[] {
  const now = nowInCampus();
  const pending = bookings.filter((b) => b.status === BookingStatus.PENDING);
  const isUpcoming = (b: IBooking) => !hasStarted(b, now);
  const cards: ApprovalCard[] = [];
  const bySeries = new Map<string, IBooking[]>();

  for (const booking of pending) {
    if (!booking.seriesId) {
      cards.push({ kind: "single", key: booking.id, booking, upcoming: isUpcoming(booking) ? [booking] : [] });
      continue;
    }
    const group = bySeries.get(booking.seriesId) ?? [];
    group.push(booking);
    bySeries.set(booking.seriesId, group);
  }

  for (const [seriesId, group] of bySeries) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    cards.push({
      kind: "series",
      key: `series:${seriesId}`,
      seriesId,
      bookings: group,
      upcoming: group.filter(isUpcoming),
    });
  }

  const firstDate = (card: ApprovalCard) => (card.kind === "single" ? card.booking.date : card.bookings[0].date);
  return cards.sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { bookings, loading, fetchPendingBookings, approveBooking, rejectBooking, reviewSeries, refetch } =
    useBookings();
  const { classrooms } = useClassrooms();
  const [busyCards, setBusyCards] = useState<Set<string>>(new Set());
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [seriesInfo, setSeriesInfo] = useState<Map<string, BookingSeriesSummary>>(new Map());

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingBookings();
  }, [isAdmin, fetchPendingBookings]);

  const cards = useMemo(() => buildCards(bookings), [bookings]);
  const seriesIdsKey = cards
    .filter((c): c is Extract<ApprovalCard, { kind: "series" }> => c.kind === "series")
    .map((c) => c.seriesId)
    .join(",");

  useEffect(() => {
    if (!seriesIdsKey) return;
    let active = true;
    fetchSeriesSummaries(seriesIdsKey.split(",")).then((list) => {
      if (active) setSeriesInfo(new Map(list.map((s) => [s.id, s])));
    });
    return () => {
      active = false;
    };
  }, [seriesIdsKey]);

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

  const setBusy = (key: string, busy: boolean) =>
    setBusyCards((prev) => {
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });

  const runAction = async (card: ApprovalCard, decision: "approve" | "reject") => {
    setBusy(card.key, true);
    setCardErrors((prev) => ({ ...prev, [card.key]: "" }));
    const result =
      card.kind === "series"
        ? await reviewSeries(card.seriesId, decision)
        : decision === "approve"
          ? await approveBooking(card.booking.id)
          : await rejectBooking(card.booking.id);
    setBusy(card.key, false);
    if (!result.success) {
      const conflicts = "conflicts" in result ? result.conflicts : undefined;
      const detail = conflicts?.length ? ` Taken: ${conflicts.map(formatDateLabel).join(", ")}.` : "";
      setCardErrors((prev) => ({ ...prev, [card.key]: `${result.error || "Action failed"}${detail}` }));
      refetch();
    }
  };

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const getClassroomName = (classroomId: string) =>
    classrooms.find((c) => c.id === classroomId)?.name || "Unknown";

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
            <p className="text-muted-foreground">Review and approve or reject booking requests</p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {cards.length} pending
          </Badge>
        </div>

        {cards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Check className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All Caught Up</h3>
              <p className="text-muted-foreground mt-2">No pending booking requests at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => {
              const first = card.kind === "single" ? card.booking : card.bookings[0];
              const summary = card.kind === "series" ? seriesInfo.get(card.seriesId) : undefined;
              const isExpanded = expanded.has(card.key);
              const busy = busyCards.has(card.key);
              const lapsedCount = (card.kind === "series" ? card.bookings.length : 1) - card.upcoming.length;
              const allLabel = card.kind === "series" ? " all" : "";

              return (
                <Card key={card.key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {first.userName}
                        </CardTitle>
                        <CardDescription>{first.userEmail}</CardDescription>
                      </div>
                      <Badge variant="warning">
                        {card.kind === "series"
                          ? `Recurring, ${card.upcoming.length} upcoming${lapsedCount ? `, ${lapsedCount} lapsed` : ""}`
                          : lapsedCount
                            ? "Already started"
                            : "Pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{getClassroomName(first.classroomId)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {card.kind === "series" ? (
                          <>
                            <RepeatIcon className="h-3.5 w-3.5" />
                            <span>{summary?.ruleText ?? `From ${formatDateLabel(first.date)}`}</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4" />
                            <span>{format(parseISO(first.date), "EEEE, MMMM d, yyyy")}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {first.startTime} - {first.endTime}
                        </span>
                      </div>
                    </div>

                    {card.kind === "series" && (
                      <div>
                        <Button variant="ghost" size="sm" className="px-0" onClick={() => toggleExpanded(card.key)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                          {isExpanded ? "Hide dates" : `Show ${card.bookings.length} dates`}
                        </Button>
                        {isExpanded && (
                          <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y text-sm">
                            {card.bookings.map((b) => (
                              <li key={b.id} className="px-3 py-1.5">
                                {formatDateLabel(b.date)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {cardErrors[card.key] && (
                      <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                        {cardErrors[card.key]}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" onClick={() => runAction(card, "reject")} disabled={busy}>
                        <X className="h-4 w-4 mr-2" />
                        Reject{allLabel}
                      </Button>
                      {card.upcoming.length > 0 && (
                        <Button onClick={() => runAction(card, "approve")} disabled={busy}>
                          <Check className="h-4 w-4 mr-2" />
                          Approve{allLabel}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
