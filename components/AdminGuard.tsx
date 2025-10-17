tournament\components\AdminGuard.tsx
Create AdminGuard for admin role protection
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AdminGuard
 *
 * Protects routes that require admin authentication and admin role.
 * Redirects to /login/admin if not authenticated or not an admin.
 */
export default function AdminGuard({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || role !== "admin") {
        router.replace("/login/admin");
      }
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Checking authentication...</p>
      </div>
    );
  }

  if (!user || role !== "admin") {
    return null; // Will redirect
  }

  return <>{children}</>;
}
