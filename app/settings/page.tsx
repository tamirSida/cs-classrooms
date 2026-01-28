"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { settingsService } from "@/lib/services";
import { ISettings } from "@/lib/models";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [operatingStart, setOperatingStart] = useState("08:00");
  const [operatingEnd, setOperatingEnd] = useState("18:00");
  const [maxTimeMode, setMaxTimeMode] = useState<"unlimited" | "custom">("custom");
  const [customMaxTime, setCustomMaxTime] = useState(60);
  const [timeSlotDuration, setTimeSlotDuration] = useState(15);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;

      setLoading(true);
      const data = await settingsService.getSettings(user.id);
      setSettings(data);
      setOperatingStart(data.operatingHours.start);
      setOperatingEnd(data.operatingHours.end);
      setTimeSlotDuration(data.timeSlotDuration);

      if (data.defaultMaxTimePerDay === -1) {
        setMaxTimeMode("unlimited");
        setCustomMaxTime(60);
      } else {
        setMaxTimeMode("custom");
        setCustomMaxTime(data.defaultMaxTimePerDay);
      }

      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const maxTime = maxTimeMode === "unlimited" ? -1 : customMaxTime;

    try {
      await settingsService.updateSettings(
        {
          operatingHours: {
            start: operatingStart,
            end: operatingEnd,
          },
          defaultMaxTimePerDay: maxTime,
          timeSlotDuration,
        },
        user.id
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Settings">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Operating Hours</CardTitle>
            <CardDescription>
              Set the hours during which classrooms can be booked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={operatingStart}
                  onChange={(e) => setOperatingStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={operatingEnd}
                  onChange={(e) => setOperatingEnd(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Limits</CardTitle>
            <CardDescription>
              Default daily time limit for student bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={maxTimeMode}
              onValueChange={(v) => setMaxTimeMode(v as "unlimited" | "custom")}
            >
              <RadioGroupItem value="unlimited" id="maxTime-unlimited">
                <span className="text-sm font-medium">Unlimited</span>
                <span className="text-xs text-muted-foreground ml-2">No daily limit</span>
              </RadioGroupItem>
              <RadioGroupItem value="custom" id="maxTime-custom">
                <span className="text-sm font-medium">Custom limit</span>
              </RadioGroupItem>
            </RadioGroup>

            {maxTimeMode === "custom" && (
              <div className="ml-7 space-y-2">
                <Label htmlFor="customMaxTime">Minutes per day</Label>
                <Input
                  id="customMaxTime"
                  type="number"
                  min="1"
                  className="w-32"
                  value={customMaxTime}
                  onChange={(e) => setCustomMaxTime(parseInt(e.target.value) || 60)}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Individual classrooms can override this with their own limits.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Slot Configuration</CardTitle>
            <CardDescription>
              Time slot granularity for bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="slotDuration">Time Slot Duration</Label>
              <Select
                value={String(timeSlotDuration)}
                onValueChange={(v) => setTimeSlotDuration(parseInt(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines the minimum booking duration and grid intervals.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
            Settings saved successfully
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
