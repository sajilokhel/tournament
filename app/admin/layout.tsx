"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Home, Calendar, MapPin, Users, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Minimal, professional Admin layout
 *
 * - Protects routes using `AdminGuard`
 * - Provides a left sidebar for navigation (desktop) and a compact top area on mobile
 * - Renders sub-route content in the right-side content area
 *
 * Usage (app/admin/layout.tsx):
 *  <AdminLayout>
 *    {children} // sub-route content (overview, bookings, users, etc.)
 *  </AdminLayout>
 */

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/overview", icon: Home },
  { label: "Bookings", href: "/admin/bookings", icon: Calendar },
  { label: "Venues", href: "/admin/venues", icon: MapPin },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin/overview";

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Next.js will handle redirect to login via guards; keep minimal here.
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  return (
    <AdminGuard>
      <SidebarProvider defaultOpen>
        <div className="min-h-screen flex bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {/* Sidebar (visible on lg+) */}
          <aside className="hidden lg:flex lg:flex-col w-72 border-r border-slate-200 dark:border-slate-800 bg-transparent">
            <Sidebar>
              <SidebarHeader>
                <div className="px-4 py-5">
                  <Link href="/admin/overview" className="flex items-center gap-3">
                    <div className="bg-primary text-primary-foreground rounded-md p-2">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Futsal Admin</div>
                      <div className="text-xs text-muted-foreground">Control panel</div>
                    </div>
                  </Link>
                </div>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Manage</SidebarGroupLabel>
                  <SidebarMenu>
                    {NAV_ITEMS.map((item) => {
                      const ActiveIcon = item.icon;
                      const active = pathname.startsWith(item.href);
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild>
                            <Link
                              href={item.href}
                              className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm ${
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                              aria-current={active ? "page" : undefined}
                            >
                              <ActiveIcon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>

              <div className="mt-auto px-4 py-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-sm"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </Button>
              </div>
            </Sidebar>
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-h-screen">
            {/* Top bar for mobile and small screens */}
            <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-transparent">
              <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/admin/overview" className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground rounded-md p-2">
                    <Home className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold">Admin</div>
                </Link>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  {/* Derive a simple title from the pathname */}
                  <h1 className="text-2xl font-bold">
                    {deriveTitleFromPath(pathname)}
                  </h1>
                  <div className="text-sm text-muted-foreground">Overview & controls</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* reserved for actions: refresh, filters, etc. */}
                  <Button onClick={() => window.location.reload()} variant="ghost" size="sm">
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Panel */}
              <div className="bg-transparent">{children}</div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </AdminGuard>
  );
}

/** Small helper to produce a readable title from route */
function deriveTitleFromPath(path: string) {
  const parts = path.replace(/^\/+/, "").split("/");
  // admin or admin/overview => Overview
  if (parts.length <= 1 || parts[1] === "" || parts[1] === "overview") return "Overview";
  const p = parts[1];
  // convert kebab to Title Case
  return p
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
