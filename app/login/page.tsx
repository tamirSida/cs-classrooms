"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft, MailCheck } from "lucide-react";

type View = "login" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, resetPassword, loading } = useAuth();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signIn(email, password);
      router.push("/calendar");
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSubmitting(true);

    try {
      await resetPassword(resetEmail);
    } catch {
      // Swallow errors to avoid email enumeration — always confirm sent.
    } finally {
      setResetSubmitting(false);
      setView("forgot-sent");
    }
  };

  const goToLogin = () => {
    setView("login");
    setError(null);
    setResetEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              {view === "forgot-sent" ? (
                <MailCheck className="h-8 w-8 text-primary" />
              ) : (
                <Calendar className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {view === "login" && "ClassScheduler"}
            {view === "forgot" && "Reset Password"}
            {view === "forgot-sent" && "Check your email"}
          </CardTitle>
          <CardDescription>
            {view === "login" && "Sign in to manage your classroom bookings"}
            {view === "forgot" && "Enter your email and we'll send you a reset link."}
            {view === "forgot-sent" && "If an account exists for that email, a reset link has been sent."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === "login" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setView("forgot");
                      setError(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={resetSubmitting}>
                {resetSubmitting ? "Sending..." : "Send Reset Link"}
              </Button>

              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </button>
            </form>
          )}

          {view === "forgot-sent" && (
            <div className="space-y-4">
              <div className="text-sm bg-muted/50 border rounded-md p-3 text-muted-foreground">
                The link will open a page where you can set a new password. If you don&apos;t see the email within a minute, <strong className="text-foreground">check your spam or junk folder</strong>.
              </div>
              <Button onClick={goToLogin} className="w-full" variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
