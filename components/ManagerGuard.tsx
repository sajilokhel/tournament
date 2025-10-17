tournament\components\ManagerGuard.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * ManagerGuard
 *
 * Protects routes that require manager authentication and manager role.
 * Redirects to /login/manager if not authenticated or not a manager.
 */
export default function ManagerGuard({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || role !== "manager") {
        router.replace("/login/manager");
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

  if (!user || role !== "manager") {
    return null; // Will redirect
  }

  return <>{children}</>;
}
