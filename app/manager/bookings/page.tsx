"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  documentId,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";

const ManagerBookingsPage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVenueAndBookings = useCallback(async () => {
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
      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (bookingsData.length > 0) {
        const userIds = [...new Set(bookingsData.map((b) => b.userId))];
        const usersQuery = query(
          collection(db, "users"),
          where(documentId(), "in", userIds)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const usersMap = new Map(
          usersSnapshot.docs.map((doc) => [doc.id, doc.data().displayName])
        );

        const combinedData = bookingsData.map((booking) => ({
          ...booking,
          userName: usersMap.get(booking.userId) || "Unknown User",
        }));

        combinedData.sort(
          (a, b) =>
            new Date(b.date + "T" + b.startTime).getTime() -
            new Date(a.date + "T" + a.startTime).getTime()
        );
        setBookings(combinedData);
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVenueAndBookings();
    }
  }, [user, fetchVenueAndBookings]);

  const handleCancelBooking = async (bookingId: string, slotId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? This will make the slot available again and notify the user."
      )
    )
      return;

    try {
      const batch = writeBatch(db);
      const bookingRef = doc(db, "bookings", bookingId);
      const slotRef = doc(db, "slots", slotId);

      batch.update(bookingRef, { status: "CANCELLED_BY_MANAGER" });
      batch.update(slotRef, {
        status: "AVAILABLE",
        heldBy: null,
        holdExpiresAt: null,
        bookingId: null,
      });

      await batch.commit();
      toast.success("Booking cancelled successfully.");
      fetchVenueAndBookings(); // Refresh the list
    } catch (error) {
      toast.error("Failed to cancel the booking.");
      console.error("Error cancelling booking:", error);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Loading bookings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-destructive/50">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive">
          An Error Occurred
        </h2>
        <p className="text-center text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Bookings</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Bookings for Your Venue</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No bookings found for your venue.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.userName}
                    </TableCell>
                    <TableCell>{booking.date}</TableCell>
                    <TableCell>{booking.startTime}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell>Rs. {booking.price}</TableCell>
                    <TableCell className="text-right">
                      {booking.status === "CONFIRMED" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleCancelBooking(booking.id, booking.slotId)
                          }
                        >
                          Cancel Booking
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerBookingsPage;
