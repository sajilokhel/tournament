"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, loading } = useAuth(); // Use the central auth context
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname?.startsWith("/auth")) {
    return null;
  }

  const navLinks = (() => {
    if (role === "admin") return [{ href: "/admin", label: "Dashboard" }];
    if (role === "manager") return [{ href: "/manager", label: "Dashboard" }];
    return [
      { href: "/", label: "Home" },
      { href: "/venues", label: "Venues" },
      { href: "/about", label: "About" },
    ];
  })();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const renderUserMenu = (isMobile = false) => {
    if (loading)
      return <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />; // Skeleton loader
    if (!user) {
      return (
        <Link href="/auth/login" className={isMobile ? "block" : ""}>
          <Button size="sm">Sign in</Button>
        </Link>
      );
    }

    const userInitial = (user.displayName ?? user.email ?? "U")
      .charAt(0)
      .toUpperCase();

    if (isMobile) {
      return (
        <div className="flex items-center gap-3 px-3">
          <Avatar>
            {user.photoURL ? (
              <AvatarImage src={user.photoURL} alt={user.displayName ?? ""} />
            ) : (
              <AvatarFallback>{userInitial}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <div className="text-sm font-medium truncate">
              {user.displayName ?? user.email}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
          <button onClick={handleSignOut} className="text-sm text-destructive">
            Logout
          </button>
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Open user menu" className="rounded-full">
            <Avatar>
              {user.photoURL ? (
                <AvatarImage src={user.photoURL} alt={user.displayName ?? ""} />
              ) : (
                <AvatarFallback>{userInitial}</AvatarFallback>
              )}
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">
              {user.displayName ?? user.email}
            </div>
            <div className="text-xs text-muted-foreground truncate">
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
          <DropdownMenuItem onClick={handleSignOut}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="w-full bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {/* Logo and Branding */}
            <Link href="/" className="flex items-center gap-3">
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

          <nav className="hidden sm:flex gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium px-2 py-1 rounded-md ${
                  pathname === link.href
                    ? "text-foreground bg-accent/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              className="sm:hidden p-2 rounded-md"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((s) => !s)}
            >
              {mobileOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
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
            <div className="hidden sm:flex">{renderUserMenu()}</div>
          </div>
        </div>

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
              <div className="border-t mt-2 pt-2">{renderUserMenu(true)}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
