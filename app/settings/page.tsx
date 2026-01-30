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
import { Save, Copy, RefreshCw, QrCode, Download } from "lucide-react";
import QRCode from "qrcode";

function generateRandomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
  const [signupCode, setSignupCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

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

      setSignupCode(data.signupCode || "");
      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  // Generate QR code when signup code changes
  useEffect(() => {
    const generateQR = async () => {
      if (signupCode && typeof window !== "undefined") {
        try {
          const url = `${window.location.origin}/join/${signupCode}`;
          const qrDataUrl = await QRCode.toDataURL(url, {
            width: 400,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQrCodeUrl(qrDataUrl);
        } catch {
          setQrCodeUrl(null);
        }
      } else {
        setQrCodeUrl(null);
      }
    };

    generateQR();
  }, [signupCode]);

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.download = `classscheduler-signup-qr-${signupCode}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

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
          signupCode: signupCode || undefined,
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Signup
            </CardTitle>
            <CardDescription>
              Allow students to self-register via QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signupCode">Signup Code</Label>
              <div className="flex gap-2">
                <Input
                  id="signupCode"
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g., cs-arazi-2024"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSignupCode(generateRandomCode())}
                  title="Generate random code"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to disable QR code signup. Only lowercase letters, numbers, and hyphens allowed.
              </p>
            </div>

            {signupCode && (
              <>
                <div className="space-y-2">
                  <Label>Signup URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${signupCode}`}
                      className="flex-1 bg-muted"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/join/${signupCode}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      title="Copy URL"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-xs text-green-600">Copied to clipboard!</p>
                  )}
                </div>

                {qrCodeUrl && (
                  <div className="space-y-3">
                    <Label>QR Code</Label>
                    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
                      <img
                        src={qrCodeUrl}
                        alt="Signup QR Code"
                        className="w-48 h-48"
                      />
                      <p className="text-sm text-muted-foreground text-center">
                        Scan to sign up as a student
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={downloadQRCode}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PNG
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowQrModal(true)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          View Large
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
      {/* QR Code Modal */}
      {showQrModal && qrCodeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowQrModal(false)}
          />
          <div className="relative bg-white rounded-xl p-8 max-w-md w-full shadow-xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Student Signup QR Code</h2>
              <div className="bg-white p-4 rounded-lg inline-block border">
                <img
                  src={qrCodeUrl}
                  alt="Signup QR Code"
                  className="w-72 h-72"
                />
              </div>
              <p className="text-sm text-gray-600 mt-4 mb-6">
                Scan this code to create a student account
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={downloadQRCode}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
                <Button variant="outline" onClick={() => setShowQrModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
