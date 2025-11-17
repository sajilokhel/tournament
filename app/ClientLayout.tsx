"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage =
    pathname?.startsWith("/auth/login") ||
    pathname?.startsWith("/auth/register");

  return (
    <AuthProvider>
      {/* Global toaster for notifications */}
      <Toaster />
      {/* Header is hidden on auth pages */}
      <Header />
      {/* Main app container — full height for auth pages, container for others */}
      <main className={isAuthPage ? "min-h-screen" : "container w-screen"}>
        {children}
      </main>
    </AuthProvider>
  );
}
