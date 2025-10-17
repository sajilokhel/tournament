"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import AuthGuard from "@/components/AuthGuard";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/**
 * Admin Dashboard
 *
 * - Full admin dashboard using real Firestore data
 * - Sidebar navigation, Tabs, Charts, Tables and action buttons
 * - Role check: only users with role "admin" or "manager" in `users/{uid}` can access
 *
 * Notes:
 * - This page is protected by AuthGuard (redirects to login if unauthenticated),
 *   and then performs a role check to ensure the user is authorized.
 * - All actions call Firestore and update real data (approve/reject bookings).
 */

type Booking = {
  id: string;
  venueId: string;
  userId: string;
  timeSlot: string;
  status: string;
  screenshotUrl?: string;
  createdAt?: string;
};

type Venue = {
  id: string;
  name?: string;
  address?: string;
};

type UserDoc = {
  id: string;
  email?: string;
  role?: string;
};

export default function AdminPanel() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);

  // Fetch auth and role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (!u) {
        setIsAuthorized(null);
        setLoading(false);
        return;
      }
      // Fetch user profile from Firestore (users/{uid}) to check role
      try {
        const userDocRef = doc(db, "users", u.uid);
        const snap = await getDoc(userDocRef);
        const data = snap.exists() ? (snap.data() as any) : null;
        const role = data?.role ?? null;
        setIsAuthorized(role === "admin" || role === "manager");
      } catch (err) {
        console.error("Failed to get user doc for role check", err);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Fetch core data for dashboard (bookings, venues, users)
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // bookings - recent 100
      const bookingsSnap = await getDocs(
        query(
          collection(db, "bookings"),
          orderBy("createdAt", "desc"),
          limit(200),
        ),
      );
      const bookingList = bookingsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Booking[];
      setBookings(bookingList);

      const venuesSnap = await getDocs(collection(db, "venues"));
      const venueList = venuesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Venue[];
      setVenues(venueList);

      const usersSnap = await getDocs(collection(db, "users"));
      const userList = usersSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as UserDoc[];
      setUsers(userList);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // Charts data: bookings per day (last 7 days) + status distribution
  const chartData = useMemo(() => {
    // Build map of last 7 days labels
    const now = new Date();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d.toLocaleDateString());
    }

    const bookingsPerDay = days.map((day) => {
      const count = bookings.filter((b) => {
        if (!b.createdAt) return false;
        const created = new Date(b.createdAt);
        return (
          created.toLocaleDateString() === new Date(day).toLocaleDateString()
        );
      }).length;
      return { day, count };
    });

    const statusCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    });

    const statusData = Object.entries(statusCounts).map(([key, value]) => ({
      name: key,
      value,
    }));

    return { bookingsPerDay, statusData };
  }, [bookings]);

  const approveBooking = async (id: string) => {
    try {
      await updateDoc(doc(db, "bookings", id), { status: "approved" });
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)),
      );
    } catch (err) {
      console.error("Approve failed", err);
      alert("Failed to approve booking");
    }
  };

  const rejectBooking = async (id: string) => {
    try {
      await updateDoc(doc(db, "bookings", id), { status: "rejected" });
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)),
      );
    } catch (err) {
      console.error("Reject failed", err);
      alert("Failed to reject booking");
    }
  };

  // If still loading or not authorized
  if (loading) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent>
              <div className="py-12 text-center text-muted-foreground">
                Loading admin dashboard…
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  if (isAuthorized === false) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent>
              <div className="py-12 text-center">
                <div className="text-lg font-semibold">Access denied</div>
                <div className="text-sm text-muted-foreground mt-2">
                  You do not have permission to access the admin dashboard.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  // Main dashboard UI
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <div className="min-h-screen flex">
          <Sidebar side="left" variant="floating" collapsible="icon">
            <SidebarHeader>
              <div className="px-3 py-2">
                <div className="text-sm font-semibold">Admin</div>
                <div className="text-xs text-muted-foreground">Dashboard</div>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Manage</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="/admin">Overview</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="/admin?tab=bookings">Bookings</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="/admin?tab=venues">Venues</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="/admin?tab=users">Users</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <div className="text-sm text-muted-foreground">
                  Overview & management
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={fetchDashboardData}>Refresh</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Total Bookings
                  </div>
                  <div className="text-2xl font-semibold mt-2">
                    {bookings.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Total Venues
                  </div>
                  <div className="text-2xl font-semibold mt-2">
                    {venues.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Total Users
                  </div>
                  <div className="text-2xl font-semibold mt-2">
                    {users.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Bookings Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      id="bookings-line"
                      config={{ bookings: { color: "var(--primary)" } }}
                    >
                      <LineChart data={chartData.bookingsPerDay}>
                        <XAxis dataKey="day" />
                        <YAxis />
                        <CartesianGrid strokeDasharray="3 3" />
                        <RechartsTooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#6366F1"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ChartContainer>

                    <Separator className="my-4" />

                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Status distribution
                      </h4>
                      <ChartContainer
                        id="booking-status"
                        config={{ pending: { color: "#FB923C" } }}
                      >
                        <ResponsiveContainer height={180}>
                          <BarChart data={chartData.statusData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Bar dataKey="value" fill="#6366F1" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bookings.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No bookings available.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Venue</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Slot</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bookings.slice(0, 50).map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="font-medium">
                                  {b.venueId}
                                </TableCell>
                                <TableCell>{b.userId}</TableCell>
                                <TableCell>{b.timeSlot}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      b.status === "pending"
                                        ? "secondary"
                                        : b.status === "approved"
                                          ? "default"
                                          : "destructive"
                                    }
                                  >
                                    {b.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {b.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => approveBooking(b.id)}
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => rejectBooking(b.id)}
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}
                                    {b.status !== "pending" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          // toggle back to pending
                                          updateDoc(doc(db, "bookings", b.id), {
                                            status: "pending",
                                          })
                                            .then(() => fetchDashboardData())
                                            .catch((err) => {
                                              console.error(err);
                                              alert("Failed to set pending");
                                            });
                                        }}
                                      >
                                        Set pending
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Venues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {venues.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No venues found.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {venues.map((v) => (
                          <div key={v.id} className="p-3 border rounded-md">
                            <div className="font-medium">{v.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {v.address}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {users.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No users found.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {users.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <div>
                                <div className="font-medium">{u.email}</div>
                                <div className="text-xs text-muted-foreground">
                                  Role: {u.role ?? "user"}
                                </div>
                              </div>
                              <div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    // Toggle role between user and manager for quick testing
                                    try {
                                      const newRole =
                                        u.role === "manager"
                                          ? "user"
                                          : "manager";
                                      await updateDoc(doc(db, "users", u.id), {
                                        role: newRole,
                                      });
                                      fetchDashboardData();
                                    } catch (err) {
                                      console.error(err);
                                      alert("Failed to update role");
                                    }
                                  }}
                                >
                                  Toggle role
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
