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
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mapAuthError } from "@/lib/auth";

export function RegisterForm({
  role = "user",
  className,
  ...props
}: {
  role?: "user" | "manager";
} & React.ComponentProps<"form">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const next = searchParams?.get("next") ?? "/";

  // Inline field errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // If the page prefilled an email via query param (e.g., forwarded from login),
  // initialize the email input.
  useEffect(() => {
    const pre = searchParams?.get("email");
    if (pre) setEmail(pre);
  }, [searchParams]);

  const safeUpsertUserDoc = async (
    uid: string,
    data: Partial<Record<string, any>>,
  ) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      const base = {
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        lastSeen: serverTimestamp(),
      };

      if (!snap.exists()) {
        await setDoc(userRef, {
          ...base,
          role: role,
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, base, { merge: true });
      }
    } catch (err) {
      console.error("safeUpsertUserDoc error:", err);
      // Do not surface Firestore internals to the user beyond a generic message.
      throw new Error("Failed to create user record");
    }
  };

  const handleEmailRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      if (!user) throw new Error("Registration returned no user");
      await safeUpsertUserDoc(user.uid, {
        email: user.email,
        displayName: name.trim(),
        photoURL: user.photoURL ?? null,
      });
      // Redirect to next; if next is not provided use role-specific fallback
      const destination =
        next && next !== "/" ? next : role === "manager" ? "/manager" : "/";
      router.replace(destination);
    } catch (err: any) {
      console.error("Email registration error:", err);
      const info = mapAuthError(err);
      if (info.field === "email") setEmailError(info.message);
      if (info.field === "password") setPasswordError(info.message);
      toast.error(info.message, { description: info.title });
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      if (!user) throw new Error("No user returned from Google sign-in");
      // Ensure users/{uid} doc exists
      await safeUpsertUserDoc(user.uid, {
        email: user.email,
        displayName: user.displayName ?? (name.trim() || null),
        photoURL: user.photoURL ?? null,
      });
      // Redirect to role-specific destination when `next` is not provided
      const destination =
        next && next !== "/" ? next : role === "manager" ? "/manager" : "/";
      router.replace(destination);
    } catch (err: any) {
      console.error("Google registration error:", err);
      const info = mapAuthError(err);
      toast.error(info.message, { description: info.title });
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotImplemented = (providerName: string) => {
    toast.info(`${providerName} registration is not implemented yet.`);
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleEmailRegister}
      {...props}
    >
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {role === "manager" ? "Create Manager Account" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your information to get started
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <FieldContent>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p id="name-error" className="text-sm text-destructive mt-1">
                {nameError}
              </p>
            )}
          </FieldContent>
        </Field>

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
              placeholder="Create a password (min. 6 characters)"
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
          <FieldLabel htmlFor="confirm">Confirm Password</FieldLabel>
          <FieldContent>
            <Input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!confirmError}
              aria-describedby={confirmError ? "confirm-error" : undefined}
            />
            {confirmError && (
              <p id="confirm-error" className="text-sm text-destructive mt-1">
                {confirmError}
              </p>
            )}
          </FieldContent>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleRegister}
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
            {loading ? "Creating..." : "Continue with Google"}
          </Button>
        </Field>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?{" "}
          </span>
          <a
            href={role === "manager" ? "/auth/login/manager" : "/auth/login"}
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Sign in
          </a>
        </div>
      </FieldGroup>
    </form>
  );
}
