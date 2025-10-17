"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ManagerRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const safeUpsertUserDoc = async (
    user: FirebaseUser,
    displayName?: string,
  ) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const base = {
      email: user.email ?? null,
      displayName: displayName ?? user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastSeen: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(userRef, {
        ...base,
        role: "manager",
        createdAt: serverTimestamp(),
      });
    } else {
      // merge lastSeen and any updated fields, but don't change role
      await setDoc(userRef, base, { merge: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      alert("Please enter your email.");
      return;
    }
    if (!password) {
      alert("Please enter a password.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      // create users/{uid} doc with role manager
      await safeUpsertUserDoc(user, name.trim());
      // redirect to manager dashboard or home
      router.replace("/");
    } catch (err: any) {
      console.error("Registration failed", err);
      alert(err?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      // If users/{uid} doesn't exist, create it with role manager
      await safeUpsertUserDoc(user);
      router.replace("/");
    } catch (err: any) {
      console.error("Google sign-in failed", err);
      alert(err?.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Form area - centered and using full height */}
      <div className="flex flex-col justify-center p-6 md:p-12">
        {/* Branding / header */}
        <div className="mb-6">
          <a href="/" className="flex items-center gap-3 font-medium">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex w-10 h-10 items-center justify-center rounded-md">
              {/* simple icon */}
              <svg
                className="w-5 h-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 12c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v4c0 1.657-1.343 3-3 3H6c-1.657 0-3-1.343-3-3v-4z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="leading-tight">
              <span className="text-lg font-semibold block">Futsal</span>
              <span className="text-xs text-muted-foreground block">
                Book your court
              </span>
            </div>
          </a>
        </div>

        {/* Form container - allow wider form and prevent overflow */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Create Manager Account</CardTitle>
                <CardDescription>
                  Register as a manager with email & password or continue with
                  Google
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="text-sm block mb-1">Full name</label>
                    <Input
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Password</label>
                    <Input
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">
                      Confirm password
                    </label>
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Creating..." : "Create Manager Account"}
                    </Button>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <div className="text-xs text-muted-foreground px-2">
                        or
                      </div>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogle}
                      disabled={loading}
                    >
                      Continue with Google
                    </Button>

                    <div className="text-sm text-muted-foreground text-center">
                      Already have an account?{" "}
                      <a href="/login/manager" className="underline">
                        Sign in
                      </a>
                    </div>
                  </div>
                </form>
              </CardContent>

              <CardFooter className="text-xs text-muted-foreground">
                By creating an account you agree to our terms of service.
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Right: Illustration / placeholder - show only on large screens */}
      <div className="relative hidden lg:flex items-center justify-center bg-gray-50 overflow-hidden">
        <img
          src="/placeholder.svg"
          alt="Illustration"
          className="w-full h-full object-cover"
        />
        {/* subtle overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
        <div className="absolute left-12 bottom-12 text-white max-w-sm pointer-events-none">
          <h2 className="text-2xl font-bold">Welcome, Manager</h2>
          <p className="mt-2 text-sm">
            Create your manager account to add and manage venues, bookings and
            verify payments.
          </p>
        </div>
      </div>
    </div>
  );
}
