"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
  FieldLabel,
  FieldContent,
} from "@/components/ui/field";

import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mapAuthError } from "@/lib/auth";

/**
 * Login form with email/password + Google
 * - After successful sign-in we check that a users/{uid} document exists.
 * - If the user document exists we redirect to `next` (or /).
 * - If it does not exist we sign the user out and redirect to /register with email prefilled.
 */
export function LoginForm({
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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const next = searchParams?.get("next") ?? "/";

  const redirectToRegisterWithEmail = (userEmail?: string) => {
    const url = `/auth/register${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ""}`;
    router.replace(url);
  };

  const checkUserDocAndRedirect = async (uid: string, userEmail?: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const userData = snap.data();
        const role = userData.role ?? "user";

        // Redirect based on role:
        // - regular users -> `next` (default: "/")
        // - managers -> "/manager/dashboard"
        // - admins -> "/admin"
        if (role === "user") {
          router.replace(next);
        } else if (role === "manager") {
          router.replace("/manager/dashboard");
        } else if (role === "admin") {
          router.replace("/admin");
        } else {
          // Unknown role: sign out and show a helpful message
          await signOut(auth);
          setError("Unrecognized account role. Please contact support.");
        }
      } else {
        // If user doc not present, sign out and send to register
        await signOut(auth);
        redirectToRegisterWithEmail(userEmail);
      }
    } catch (err) {
      console.error("Failed to verify user doc:", err);
      setError("Failed to verify account. Try again later.");
    }
  };

  const handleEmailPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      if (info.field === "email") setEmailError(info.message);
      if (info.field === "password") setPasswordError(info.message);
      toast.error(info.message, { description: info.title });
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setEmailError(null);
    setPasswordError(null);
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

  const handleNotImplemented = (providerName: string) => {
    toast.info(`${providerName} login is not implemented yet.`);
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
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      const info = mapAuthError(err);
      toast.error(info.message, { description: info.title });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleEmailPassword}
      {...props}
    >
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to sign in to your account
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
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
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
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
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading || loading}
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
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

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 w-full"
            disabled={loading}
          >
            {/* Google SVG icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </Button>
        </Field>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleNotImplemented("GitHub")}
            className="flex items-center justify-center gap-2 w-full"
          >
            {/* GitHub mark (simple) */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" fill="currentColor"/>
            </svg>
            Login with GitHub
          </Button>
        </Field>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Don&apos;t have an account?{" "}
          </span>
          <a
            href="/auth/register"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Sign up
          </a>
        </div>
      </FieldGroup>
    </form>
  );
}
