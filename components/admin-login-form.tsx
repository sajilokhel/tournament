tournament\components\admin-login-form.tsx
Create admin login form component
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldContent,
} from "@/components/ui/field";

import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      if (!user) throw new Error("No user returned from sign-in");
      await checkUserDocAndRedirect(user.uid, user.email ?? undefined);
    } catch (err: any) {
      console.error("Email sign-in error:", err);
      setError(err?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      alert("Please enter your email address first.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      alert(err?.message ?? "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6 w-full", className)}
      onSubmit={handleEmailPassword}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center mb-2">
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
              className="w-full rounded border px-3 py-2"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent>
            <input
              id="password"
              type="password"
              className="w-full rounded border px-3 py-2"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </FieldContent>
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

        <Field>
          <div className="mt-2 text-center">
            <FieldDescription>
              Admin access only.
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
