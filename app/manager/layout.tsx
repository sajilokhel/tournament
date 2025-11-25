"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Settings, Menu, Home, LogOut, User, CreditCard, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface ManagerLayoutProps {
  children: React.ReactNode;
}

const ManagerLayout = ({ children }: ManagerLayoutProps) => {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Access Denied
          </h2>
          <p className="text-gray-600">You must be logged in as a manager.</p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/login/manager">
              <Button>Manager Login</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      href: "/",
      label: "Homepage",
      icon: Home,
    },
    {
      href: "/manager/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/manager/bookings",
      label: "Bookings",
      icon: Calendar,
    },
    {
      href: "/manager/payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      href: "/manager/venue-settings",
      label: "My Venue",
      icon: Settings,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen transition-transform duration-300 ease-in-out bg-white border-r border-gray-200",
          "w-64 z-40",
          "lg:translate-x-0", // Always visible on desktop
          sidebarOpen ? "translate-x-0" : "-translate-x-full" // Slide in/out on mobile
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden" // Only show toggle on mobile
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/" ? pathname === "/" : (pathname === item.href || pathname.startsWith(item.href + "/"));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-green-50 text-green-600 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info Section */}
          <div className="p-3 border-t border-gray-200">
            <div className="space-y-2">
              {/* User Info */}
              <Link href="/manager/profile">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.email?.split('@')[0] || 'Manager'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </Link>
              
              {/* Sign Out Button */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-700 hover:bg-red-50 hover:text-red-600"
                onClick={async () => {
                  await signOut(auth);
                  window.location.href = '/';
                }}
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button - Fixed at top */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          "fixed top-4 left-4 z-50 lg:hidden bg-white p-2 rounded-lg shadow-md border border-gray-200",
          sidebarOpen && "left-[17rem]" // Move button with sidebar or keep it fixed? Better to just toggle.
        )}
      >
        {sidebarOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
      </button>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default ManagerLayout;
