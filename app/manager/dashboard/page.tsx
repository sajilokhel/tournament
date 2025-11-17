"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

const ManagerDashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeBookings: 0,
    pendingBookings: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "PENDING_PAYMENT":
        return <Badge variant="secondary">Pending</Badge>;
      case "CANCELLED":
        return <Badge variant="outline">Cancelled (User)</Badge>;
      case "CANCELLED_BY_MANAGER":
        return <Badge variant="destructive">Cancelled (Manager)</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const venuesQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid)
      );
      const venueSnapshot = await getDocs(venuesQuery);

      if (venueSnapshot.empty) {
        throw new Error("You are not assigned to manage any venues.");
      }

      const managerVenueId = venueSnapshot.docs[0].id;

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("venueId", "==", managerVenueId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const allBookings = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let totalRevenue = 0;
      let activeBookings = 0;
      let pendingBookings = 0;

      allBookings.forEach((booking) => {
        if (booking.status === "CONFIRMED") {
          totalRevenue += booking.price;
          activeBookings++;
        }
        if (booking.status === "PENDING_PAYMENT") {
          pendingBookings++;
        }
      });

      setStats({ totalRevenue, activeBookings, pendingBookings });

      const sortedBookings = allBookings.sort(
        (a, b) =>
          new Date(b.date + "T" + b.startTime).getTime() -
          new Date(a.date + "T" + a.startTime).getTime()
      );
      setRecentBookings(sortedBookings.slice(0, 5));
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Loading Dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 p-6 rounded-lg">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive">
          An Error Occurred
        </h2>
        <p className="text-center text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manager Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
            <CardDescription>From all confirmed bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              Rs. {stats.totalRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Bookings</CardTitle>
            <CardDescription>Confirmed and paid bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeBookings}</p>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBookings} pending payment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Venue Rating</CardTitle>
            <CardDescription>Customer satisfaction score</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">N/A</p>
            <p className="text-xs text-muted-foreground">
              Review system not yet implemented
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>
                A list of the 5 most recent bookings for your venue.
              </CardDescription>
            </div>
            <Link
              href="/manager/bookings"
              className="text-sm text-blue-500 hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent bookings to display.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.date}</TableCell>
                      <TableCell>{b.startTime}</TableCell>
                      <TableCell>{getStatusBadge(b.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboardPage;
