"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Professional Navbar
 *
 * - Branding/logo on the left.
 * - Center navigation with active link highlighting (hidden on small screens).
 * - Right side: user area with avatar dropdown (Profile, Settings, History, Logout).
 * - Responsive: simple mobile menu toggle for small screens.
 *
 * Hooks are called unconditionally to respect React rules.
 */
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth subscription + fetch role from Firestore
  useEffect(() => {
    let mounted = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Clear role when signed out
      if (!u) {
        setRole(null);
        return;
      }

      // Try to load the user's role from Firestore (collection `users/{uid}`)
      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (mounted && snap.exists()) {
          const data = snap.data() as any;
          setRole(data?.role ?? null);
        } else if (mounted) {
          setRole(null);
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
        if (mounted) setRole(null);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Hide header on auth pages (login and register)
  if (pathname && pathname.startsWith("/auth")) {
    return null;
  }

  // Role-aware navigation:
  // - regular users (or unauthenticated) see Home / Venues / About
  // - managers and admins see a single link labeled "Dashboard"
  //   that points to the appropriate dashboard path per role.
  const navLinks = (() => {
    if (role === "admin") {
      return [{ href: "/admin", label: "Dashboard" }];
    }
    if (role === "manager") {
      return [{ href: "/manager", label: "Dashboard" }];
    }
    return [
      { href: "/", label: "Home" },
      { href: "/venues", label: "Venues" },
      { href: "/about", label: "About" },
    ];
  })();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // redirect to login after sign out
      router.replace("/auth/login");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <header className="w-full bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              {/* Simple inline SVG logo; replace with your actual logo if available */}
              <div className="w-10 h-10 rounded-md bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M3 12c0-1.657 1.343-3 3-3h12c1.657 0 3 1.343 3 3v4c0 1.657-1.343 3-3 3H6c-1.657 0-3-1.343-3-3v-4z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="flex flex-col leading-4">
                <span className="text-lg font-semibold">Futsal</span>
                <span className="text-xs text-muted-foreground -mt-0.5">
                  Book your court
                </span>
              </div>
            </Link>
          </div>

          {/* Center navigation - hidden on small screens */}
          <nav className="hidden sm:flex gap-6">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium px-2 py-1 rounded-md ${
                    isActive
                      ? "text-foreground bg-accent/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: user / sign-in */}
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="sm:hidden p-2 rounded-md hover:bg-accent/5"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((s) => !s)}
            >
              {mobileOpen ? (
                // X icon
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                // Hamburger icon
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 12h18M3 6h18M3 18h18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Open user menu"
                    className="inline-flex items-center rounded-full focus:outline-none"
                  >
                    <Avatar>
                      {user.photoURL ? (
                        <AvatarImage
                          src={user.photoURL}
                          alt={user.displayName ?? user.email ?? "User"}
                        />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          {(user.email ?? "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-48">
                  <div className="px-3 py-2">
                    <div className="text-sm font-medium">
                      {user.displayName ?? user.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>

                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/history">History</Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleSignOut}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="sm:hidden mt-2 pb-4">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/5"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t mt-2 pt-2">
                {user ? (
                  <div className="flex items-center gap-3 px-3">
                    <Avatar>
                      {user.photoURL ? (
                        <AvatarImage
                          src={user.photoURL}
                          alt={user.displayName ?? user.email ?? "User"}
                        />
                      ) : (
                        <AvatarFallback>
                          {(user.email ?? "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {user.displayName ?? user.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="text-sm text-destructive"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="px-3">
                    <Link href="/auth/login" className="block">
                      <Button size="sm">Sign in</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
