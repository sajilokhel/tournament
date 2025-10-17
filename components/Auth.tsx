"use client";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Auth (professional)
 *
 * - When no user: show a prominent "Sign in" button linking to /login.
 * - When signed in: show an avatar trigger with a dropdown containing user info,
 *   link to admin panel (if applicable), and a sign out action.
 *
 * Uses shadcn-style UI components for a polished appearance.
 */
export default function Auth() {
  const { user, loading, role } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  // While checking auth state, render a small placeholder to avoid layout shift
  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Button variant="ghost" size="sm" disabled>
          ...
        </Button>
      </div>
    );
  }

  // Not authenticated -> show Sign In button
  if (!user) {
    return (
      <Link href="/login" className="inline-block">
        <Button variant="default" size="sm">
          Sign in
        </Button>
      </Link>
    );
  }

  // Authenticated -> show avatar + dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="User menu" className="inline-flex items-center">
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
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium">
            {user.displayName ?? user.email}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>

        {role === "user" && (
          <DropdownMenuItem asChild>
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
        )}

        {role === "manager" && (
          <DropdownMenuItem asChild>
            <Link href="/manager">Manager Dashboard</Link>
          </DropdownMenuItem>
        )}

        {role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin Panel</Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleLogout}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
