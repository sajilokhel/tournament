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
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Settings, Users, Store, CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NoVenueAccess } from "@/components/manager/NoVenueAccess";
import { calculateCommission, getVenueCommission } from "@/lib/commission";

const ManagerDashboardPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeBookings: 0,
    pendingBookings: 0,
    physicalBookings: 0,
    onlineBookings: 0,
    commissionPercentage: 0,
    commissionAmount: 0,
    netRevenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVenueAccess, setHasVenueAccess] = useState<boolean | null>(null);
  const [venueIds, setVenueIds] = useState<string[]>([]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
      case "CONFIRMED":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "pending_payment":
      case "PENDING_PAYMENT":
        return <Badge variant="secondary">Pending</Badge>;
      case "cancelled":
      case "CANCELLED":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Some venues may store `managedBy` as a string (single manager)
      // while others may store it as an array of manager UIDs.
      // Run both queries and merge results to be tolerant of both shapes.
      const eqQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid),
      );
      const arrQuery = query(
        collection(db, "venues"),
        where("managedBy", "array-contains", user.uid),
      );

      const [eqSnap, arrSnap] = await Promise.all([getDocs(eqQuery), getDocs(arrQuery)]);

      // Merge unique docs from both snapshots
      const docsMap = new Map<string, any>();
      eqSnap.docs.forEach((d) => docsMap.set(d.id, d));
      arrSnap.docs.forEach((d) => docsMap.set(d.id, d));

      if (docsMap.size === 0) {
        setHasVenueAccess(false);
        setLoading(false);
        return;
      }

      setHasVenueAccess(true);

      // Collect all venues managed by this manager
      const managerVenueIds = Array.from(docsMap.keys());
      setVenueIds(managerVenueIds);

      // Build a map of venue data for commission and display
      const venuesMap = new Map<string, any>();
      Array.from(docsMap.values()).forEach((d: any) => venuesMap.set(d.id, d.data()));

      // Fetch bookings for all venues (chunked for `in` query limit)
      const allBookings: any[] = [];
      for (let i = 0; i < managerVenueIds.length; i += 10) {
        const chunk = managerVenueIds.slice(i, i + 10);
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("venueId", "in", chunk),
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        bookingsSnapshot.docs.forEach((doc) => allBookings.push({ id: doc.id, ...doc.data() }));
      }

      // Aggregate stats across all venues and compute commission per-venue
      const revenueByVenue = new Map<string, number>();
      let totalRevenue = 0;
      let activeBookings = 0;
      let pendingBookings = 0;
      let physicalBookings = 0;
      let onlineBookings = 0;

      allBookings.forEach((booking: any) => {
        const status = (booking.status || "").toLowerCase();

        if (status === "confirmed" || status === "completed") {
          const amount = Number(booking.amount || booking.price || 0) || 0;
          // Count revenue only when amount is present
          totalRevenue += amount;

          // Sum per-venue revenue
          const prev = revenueByVenue.get(booking.venueId) || 0;
          revenueByVenue.set(booking.venueId, prev + amount);

          activeBookings++;
          if ((booking.bookingType || "").toLowerCase() === "physical") {
            physicalBookings++;
          } else {
            onlineBookings++;
          }
        }

        if (status === "pending_payment") {
          pendingBookings++;
        }
      });

      // Commission: calculate per-venue and sum
      let totalCommissionAmount = 0;
      let totalNetRevenue = 0;
      revenueByVenue.forEach((venueGross, vid) => {
        const vData = venuesMap.get(vid) || {};
        const pct = getVenueCommission(vData) || 0;
        const c = calculateCommission(venueGross, pct);
        totalCommissionAmount += c.commissionAmount;
        totalNetRevenue += c.netRevenue;
      });

      setStats({
        totalRevenue,
        activeBookings,
        pendingBookings,
        physicalBookings,
        onlineBookings,
        commissionPercentage: 0, // multiple venues; not a single pct
        commissionAmount: totalCommissionAmount,
        netRevenue: totalNetRevenue,
      });

      const sortedBookings = allBookings.sort(
        (a: any, b: any) =>
          new Date(b.date + "T" + b.startTime).getTime() -
          new Date(a.date + "T" + a.startTime).getTime(),
      );
      setRecentBookings(sortedBookings.slice(0, 5));
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setHasVenueAccess(false);
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
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasVenueAccess === false) {
    return <NoVenueAccess />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pt-14 lg:pt-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your venue's performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const firstVenueId = venueIds && venueIds.length > 0 ? venueIds[0] : null;
              if (firstVenueId) router.push(`/venue/${firstVenueId}`);
            }}
            variant="outline"
            disabled={!venueIds || venueIds.length === 0}
          >
            <Store className="mr-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                <span className="text-xs sm:text-sm text-muted-foreground">Gross Revenue:</span>
                <span className="text-base sm:text-xl font-bold">Rs. {stats.totalRevenue.toLocaleString()}</span>
              </div>
              {stats.commissionPercentage > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-muted-foreground">Commission ({stats.commissionPercentage}%):</span>
                    <span className="text-xs sm:text-sm text-red-600 font-medium">- Rs. {stats.commissionAmount.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm font-medium">Net Revenue:</span>
                    <span className="text-base sm:text-2xl font-bold text-green-600">Rs. {stats.netRevenue.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From {stats.onlineBookings} online bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.activeBookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBookings} pending payment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-sm font-medium">Physical Bookings</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.physicalBookings}</div>
            <p className="text-xs text-muted-foreground">
              Manual reservations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-sm font-medium">Online Bookings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.onlineBookings}</div>
            <p className="text-xs text-muted-foreground">
              Website reservations
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>
                Latest booking activity for your venue.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/manager/bookings">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No bookings found.
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">
                          {booking.bookingType === "physical" ? (
                            <div className="flex flex-col">
                              <span>{booking.customerName || "Walk-in"}</span>
                              <span className="text-xs text-muted-foreground">{booking.customerPhone}</span>
                            </div>
                          ) : (
                            <span>Online User</span>
                          )}
                        </div>
                        {getStatusBadge(booking.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex flex-col text-muted-foreground">
                          <span className="text-xs uppercase tracking-wider">Date</span>
                          <span className="text-gray-900">{booking.date}</span>
                        </div>
                        <div className="flex flex-col text-muted-foreground">
                          <span className="text-xs uppercase tracking-wider">Time</span>
                          <span className="text-gray-900">{booking.startTime} - {booking.endTime}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <div>
                          {booking.bookingType === "physical" ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">Physical</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Online</Badge>
                          )}
                        </div>
                        <div className="font-bold">
                          {booking.amount ? `Rs. ${booking.amount}` : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.bookingType === "physical" ? (
                              <div className="flex flex-col">
                                <span>{booking.customerName || "Walk-in"}</span>
                                <span className="text-xs text-muted-foreground">{booking.customerPhone}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span>Online User</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{booking.date}</span>
                              <span className="text-xs text-muted-foreground">
                                {booking.startTime} - {booking.endTime}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {booking.bookingType === "physical" ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Physical</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Online</Badge>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-right">
                            {booking.amount ? `Rs. ${booking.amount}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your venue efficiently</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => router.push("/manager/calendar")}
            >
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Manage Calendar</div>
                <div className="text-xs text-muted-foreground">Block slots or add physical bookings</div>
              </div>
            </Button> */}
            
            <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => router.push(`/manager/venue-settings`)}
            >
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Venue Settings</div>
                <div className="text-xs text-muted-foreground">Update price, description, and amenities</div>
              </div>
            </Button>

            <Button 
              className="w-full justify-start h-auto py-4" 
              variant="outline"
              onClick={() => router.push("/manager/bookings")}
            >
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">All Bookings</div>
                <div className="text-xs text-muted-foreground">View and manage all booking history</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboardPage;
