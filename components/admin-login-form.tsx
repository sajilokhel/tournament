"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldSeparator,
} from "@/components/ui/field";

import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { toast } from "sonner";
import { mapAuthError } from "@/lib/auth";

/**
 * Admin Login form with email/password only
 * - After successful sign-in we check that a users/{uid} document exists and role is admin.
 * - If the user document exists and role is admin, redirect to `next` (or /admin).
 * - If it does not exist or wrong role, sign the user out and show error.
 */
export function AdminLoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Field-specific inline errors (used to show inline validation messages)
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const next = searchParams?.get("next") ?? "/admin";

  const checkUserDocAndRedirect = async (uid: string, userEmail?: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const userData = snap.data();
        if (userData.role === "admin") {
          router.replace(next);
        } else {
          // Wrong role, sign out and show error
          await signOut(auth);
          setError("Access denied. This is not an admin account.");
        }
      } else {
        // If user doc not present, sign out and show error
        await signOut(auth);
        setError("Admin account not found. Please contact support.");
      }
    } catch (err) {
      console.error("Failed to verify user doc:", err);
      setError("Failed to verify account. Try again later.");
    }
  };

  const handleEmailPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // clear UI errors
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      if (!user) throw new Error("No user returned from sign-in");
      await checkUserDocAndRedirect(user.uid, user.email ?? undefined);
    } catch (err: any) {
      console.error("Email sign-in error:", err);
      const info = mapAuthError(err);
      // attach to fields when appropriate
      if (info.field === "email") setEmailError(info.message);
      if (info.field === "password") setPasswordError(info.message);
      // show toast for contextual feedback
      toast.error(info.message, { description: info.title });
      // keep a short general string for legacy UI if needed
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      const msg = "Please enter your email address first.";
      setEmailError(msg);
      toast.error(msg);
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      const info = mapAuthError(err);
      toast.error(info.message, { description: info.title });
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      if (!user) throw new Error("No user returned from Google sign-in");
      await checkUserDocAndRedirect(user.uid, user.email ?? undefined);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      const info = mapAuthError(err);
      toast.error(info.message, { description: info.title });
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-4 w-full max-w-md mx-auto", className)}
      onSubmit={handleEmailPassword}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center mb-1">
          <h1 className="text-2xl font-bold">Admin Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with your admin email & password
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <input
              id="email"
              type="email"
              className="w-full rounded border px-3 py-1"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-destructive mt-1">
                {emailError}
              </p>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent>
            <input
              id="password"
              type="password"
              className="w-full rounded border px-3 py-1"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
            />
            {passwordError && (
              <p id="password-error" className="text-sm text-destructive mt-1">
                {passwordError}
              </p>
            )}
          </FieldContent>
        </Field>
        <Field>
          <div className="mt-1 text-right">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading || loading}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {resetLoading ? "Sending..." : "Forgot password?"}
            </button>
          </div>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </Field>

        <FieldSeparator />

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 w-full"
            disabled={loading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.72 1.21 9.23 3.58l6.93-6.93C34.96 2.26 29.77 0 24 0 14.84 0 6.96 5.39 3.04 13.2l7.99 6.2C12.86 13.06 18.98 9.5 24 9.5z"
              />
              <path
                fill="#34A853"
                d="M46.7 24.5c0-1.67-.17-3.28-.5-4.82H24v9.12h12.9c-.56 2.96-2.4 5.45-5.1 7.12l7.97 6.18C43.9 38.22 46.7 31.9 46.7 24.5z"
              />
              <path
                fill="#4A90E2"
                d="M10.03 28.12A14.99 14.99 0 0 1 9 24.5c0-1.48.23-2.91.64-4.26L1.65 13.98A23.98 23.98 0 0 0 0 24.5c0 3.97.94 7.71 2.64 11.06l7.39-7.44z"
              />
              <path
                fill="#FBBC05"
                d="M24 48c6.48 0 11.92-2.14 15.9-5.8l-7.97-6.18C29.65 35.78 27 36.5 24 36.5c-6.98 0-12.9-4.64-15-10.92l-7.99 6.2C6.96 42.61 14.84 48 24 48z"
              />
            </svg>
            {loading ? "Signing in…" : "Sign in with Google"}
          </Button>
        </Field>

        <Field>
          <div className="mt-2 text-center">
            <FieldDescription>Admin access only.</FieldDescription>
          </div>
        </Field>
      </FieldGroup>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
