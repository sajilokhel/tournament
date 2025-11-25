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
  const [venueId, setVenueId] = useState<string | null>(null);

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
      const venuesQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid),
      );
      const venueSnapshot = await getDocs(venuesQuery);

      if (venueSnapshot.empty) {
        setHasVenueAccess(false);
        setLoading(false);
        return;
      }

      setHasVenueAccess(true);
      const managerVenueId = venueSnapshot.docs[0].id;
      setVenueId(managerVenueId);

      // Get venue data for commission percentage
      const venueData = venueSnapshot.docs[0].data();
      const commissionPercentage = getVenueCommission(venueData);

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("venueId", "==", managerVenueId),
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const allBookings = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      let totalRevenue = 0;
      let activeBookings = 0;
      let pendingBookings = 0;
      let physicalBookings = 0;
      let onlineBookings = 0;

      allBookings.forEach((booking: any) => {
        const status = booking.status?.toLowerCase();
        
        if (status === "confirmed") {
          // Only count revenue for online bookings or if amount is explicitly set
          // Physical bookings usually have 0 amount in this system unless manually tracked
          if (booking.amount) {
            totalRevenue += Number(booking.amount);
          }
          activeBookings++;

          if (booking.bookingType === "physical") {
            physicalBookings++;
          } else {
            onlineBookings++;
          }
        }
        
        if (status === "pending_payment") {
          pendingBookings++;
        }
      });

      setStats({ 
        totalRevenue, 
        activeBookings, 
        pendingBookings,
        physicalBookings,
        onlineBookings,
        commissionPercentage,
        commissionAmount: calculateCommission(totalRevenue, commissionPercentage).commissionAmount,
        netRevenue: calculateCommission(totalRevenue, commissionPercentage).netRevenue,
      });

      // Sort by date and time (descending)
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your venue's performance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/venue/${venueId}`)} variant="outline">
            <Store className="mr-2 h-4 w-4" />
            View Venue
          </Button>
          
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Gross Revenue:</span>
                <span className="text-xl font-bold">Rs. {stats.totalRevenue.toLocaleString()}</span>
              </div>
              {stats.commissionPercentage > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Commission ({stats.commissionPercentage}%):</span>
                    <span className="text-red-600 font-medium">- Rs. {stats.commissionAmount.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium">Net Revenue:</span>
                    <span className="text-2xl font-bold text-green-600">Rs. {stats.netRevenue.toLocaleString()}</span>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBookings} pending payment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Physical Bookings</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.physicalBookings}</div>
            <p className="text-xs text-muted-foreground">
              Manual reservations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Bookings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onlineBookings}</div>
            <p className="text-xs text-muted-foreground">
              Website reservations
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Bookings */}
        <Card className="col-span-4">
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
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No bookings found.
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3">
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
