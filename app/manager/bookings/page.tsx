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
  updateDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NoVenueAccess } from "@/components/manager/NoVenueAccess";
import { managerCancelBooking } from "@/app/actions/bookings";

const ManagerBookingsPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVenueAccess, setHasVenueAccess] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);

  const fetchVenueAndBookings = useCallback(async () => {
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

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("venueId", "==", managerVenueId),
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch user details for online bookings
      const onlineBookings = bookingsData.filter(b => b.bookingType !== "physical" && b.userId);
      const userIds = [...new Set(onlineBookings.map((b) => b.userId))];
      
      let usersMap = new Map();
      
      if (userIds.length > 0) {
        // Firestore 'in' query limit is 10, so we might need to batch if many users
        // For now, assuming < 10 unique users in recent view or handling simply
        // If > 10, we should chunk. Let's just fetch all for now or handle gracefully.
        // A better approach for production with many users is to store displayName in booking
        
        // Chunking for safety
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const usersQuery = query(
            collection(db, "users"),
            where(documentId(), "in", chunk),
          );
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.docs.forEach((doc) => {
            usersMap.set(doc.id, doc.data().displayName);
          });
        }
      }

      const combinedData = bookingsData.map((booking) => {
        let displayName = "Unknown";
        let contact = "";

        if (booking.bookingType === "physical") {
          displayName = booking.customerName || "Walk-in";
          contact = booking.customerPhone || "";
        } else {
          displayName = usersMap.get(booking.userId) || "Online User";
          // We don't usually have phone for online users unless stored in profile
        }

        return {
          ...booking,
          displayName,
          contact,
        };
      });

      combinedData.sort(
        (a, b) =>
          new Date(b.date + "T" + b.startTime).getTime() -
          new Date(a.date + "T" + a.startTime).getTime(),
      );
      
      setBookings(combinedData);
      setFilteredBookings(combinedData);
    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      toast.error("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVenueAndBookings();
    }
  }, [user, fetchVenueAndBookings]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredBookings(bookings);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = bookings.filter(
        (b) =>
          b.displayName.toLowerCase().includes(lowerTerm) ||
          b.date.includes(lowerTerm) ||
          b.status.toLowerCase().includes(lowerTerm)
      );
      setFilteredBookings(filtered);
    }
  }, [searchTerm, bookings]);

  const handleCancelBooking = async (booking: any) => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? This will make the slot available again.",
      )
    )
      return;

    try {
      if (!user) return;
      const token = await user.getIdToken();
      
      const result = await managerCancelBooking(token, booking.id);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to cancel booking");
      }

      toast.success("Booking cancelled successfully.");
      fetchVenueAndBookings(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel the booking.");
      console.error("Error cancelling booking:", error);
    }
  };

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
        return <Badge variant="outline">Cancelled (User)</Badge>;
      case "cancelled_by_manager":
      case "CANCELLED_BY_MANAGER":
        return <Badge variant="destructive">Cancelled (Manager)</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Manage Bookings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>All Bookings</CardTitle>
              <CardDescription>View and manage all bookings for your venue</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "No bookings match your search." : "No bookings found for your venue."}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{booking.displayName}</span>
                          {booking.contact && (
                            <span className="text-xs text-muted-foreground">{booking.contact}</span>
                          )}
                        </div>
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
                      <TableCell>
                        {booking.amount ? `Rs. ${booking.amount}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(booking.status === "CONFIRMED" || booking.status === "confirmed") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelBooking(booking)}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerBookingsPage;
