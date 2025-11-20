"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Calendar, MapPin, Users, Activity, PlusCircle } from "lucide-react";

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

import {
  ChartContainer,
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
  const router = useRouter();
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

    const pendingCount = bookings.filter((b) => b.status === "pending").length;
    const approvedCount = bookings.filter((b) => b.status === "approved").length;

    return { bookingsPerDay, statusData, pendingCount };
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
      <div className="container mx-auto p-6">
        <Card>
          <CardContent>
            <div className="py-12 text-center text-muted-foreground">
              Loading admin dashboard…
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
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
    );
  }

  // Main dashboard UI
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview & management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={fetchDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.length}</div>
            <p className="text-xs text-muted-foreground">
              All time bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chartData.pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Venues</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{venues.length}</div>
            <p className="text-xs text-muted-foreground">
              Venues available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         <Button className="w-full justify-start h-auto py-4 flex-col items-start gap-1" variant="outline" onClick={() => router.push('/admin/venues')}>
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold">Add Venue</span>
            </div>
            <span className="text-xs text-muted-foreground">Create a new sport venue</span>
         </Button>
         <Button className="w-full justify-start h-auto py-4 flex-col items-start gap-1" variant="outline" onClick={() => router.push('/admin/users')}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">Manage Users</span>
            </div>
            <span className="text-xs text-muted-foreground">View and edit user roles</span>
         </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Left Column: Charts & Recent Bookings */}
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bookings Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <ChartContainer
                id="bookings-line"
                config={{ bookings: { color: "var(--primary)" } }}
                className="h-[250px] w-full"
              >
                <LineChart data={chartData.bookingsPerDay}>
                  <XAxis
                    dataKey="day"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.slice(0, 10).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-xs">
                          {b.venueId}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[100px]" title={b.userId}>
                          {b.userId}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {b.timeSlot}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              b.status === "pending"
                                ? "secondary"
                                : b.status === "approved"
                                ? "default"
                                : "destructive"
                            }
                            className="text-[10px] px-1.5 py-0.5"
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
                                  className="h-7 text-xs"
                                  onClick={() => approveBooking(b.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
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
                                className="h-7 text-xs"
                                onClick={() => {
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
                                Reset
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

        {/* Right Column: Status, Venues, Users */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                id="booking-status"
                config={{ pending: { color: "#FB923C" } }}
                className="h-[200px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.statusData}>
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Bar dataKey="value" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

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
                <div className="space-y-4">
                  {venues.slice(0, 5).map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between space-x-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-muted p-2 rounded-full">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {v.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {v.address}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="space-y-4">
                  {users.slice(0, 5).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between space-x-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-muted p-2 rounded-full">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none truncate max-w-[120px]">
                            {u.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.role ?? "user"}
                          </p>
                        </div>
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
  );
}
