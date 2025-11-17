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

export default function Auth() {
  const { user, loading, role } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Button variant="ghost" size="sm" disabled>
          ...
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <Link href="/auth/login" className="inline-block">
        <Button variant="default" size="sm">
          Sign in
        </Button>
      </Link>
    );
  }

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
