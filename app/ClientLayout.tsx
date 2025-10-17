"use client";

import Header from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {/* Global toaster for notifications */}
      <Toaster />
      {/* Header is a client component and will hide itself on /login */}
      <Header />
      {/* Main app container — provides consistent page padding & centered content */}
      <main className="container ml-auto pl-4">{children}</main>
    </AuthProvider>
  );
}
