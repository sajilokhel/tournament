"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  
  // Hide header for admin and manager dashboard routes (they have their own sidebars)
  const hideHeader = 
    isAuthPage ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/manager");

  return (
    <AuthProvider>
      {/* Global toaster for notifications */}
      <Toaster />
      {/* Header is hidden on auth pages, admin, and manager routes */}
      {!hideHeader && <Header />}
      {/* Main app container — full height for auth pages, container for others */}
      <main className={isAuthPage ? "min-h-screen" : ""}>
        <Suspense
          fallback={
            <div className="w-full">
              <div className="h-6 w-full rounded bg-muted animate-pulse" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
      {/* Footer - Hidden on auth pages, admin, and manager routes */}
      {!hideHeader && <Footer />}
    </AuthProvider>
  );
}
