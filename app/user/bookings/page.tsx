"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Calendar,
  Clock,
  AlertTriangle,
  BadgeCheck,
  Ban,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const UserBookingsPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [bookings, setBookings] = useState<any[]>([]);
  const [venues, setVenues] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchBookings = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "bookings"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const bookingsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch venue details for each booking
        const venueIds = [...new Set(bookingsData.map((b) => b.venueId))];
        const venuePromises = venueIds.map((id) =>
          getDoc(doc(db, "venues", id as string))
        );
        const venueDocs = await Promise.all(venuePromises);
        const venuesMap = venueDocs.reduce((acc, doc) => {
          if (doc.exists()) acc[doc.id] = doc.data();
          return acc;
        }, {});

        setBookings(bookingsData);
        setVenues(venuesMap);
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        toast.error("Could not load your bookings.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user, router]);

  const handleCancelBooking = async (bookingId: string, slotId: string) => {
    setCancellingId(bookingId);
    try {
      const batch = writeBatch(db);
      const bookingRef = doc(db, "bookings", bookingId);
      const slotRef = doc(db, "slots", slotId);

      // For now, we assume a full refund and make the slot available.
      // A real-world scenario would check cancellation policies here.

      batch.update(bookingRef, { status: "CANCELLED" });
      batch.update(slotRef, { status: "AVAILABLE", bookingId: null });

      await batch.commit();

      setBookings(
        bookings.map((b) =>
          b.id === bookingId ? { ...b, status: "CANCELLED" } : b
        )
      );
      toast.success("Booking cancelled successfully.");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusComponent = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="flex items-center gap-2 text-green-600">
            <BadgeCheck size={16} /> Confirmed
          </span>
        );
      case "PENDING_PAYMENT":
        return (
          <span className="flex items-center gap-2 text-yellow-600">
            <Clock size={16} /> Pending Payment
          </span>
        );
      case "CANCELLED":
        return (
          <span className="flex items-center gap-2 text-red-600">
            <Ban size={16} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-2 text-gray-500">
            <Info size={16} /> {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center h-screen">
        <Loader2 className="animate-spin mr-2" /> Loading your bookings...
      </div>
    );
  }

  const upcomingBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.date) >= new Date()
  );
  const pastBookings = bookings.filter(
    (b) => b.status !== "CONFIRMED" || new Date(b.date) < new Date()
  );

  const highlightedBookingId = searchParams.get("highlight");

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">
            Upcoming
          </h2>
          {upcomingBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={`${
                    highlightedBookingId === booking.id
                      ? "ring-2 ring-brand-primary"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle>
                      {venues[booking.venueId]?.name || "Venue loading..."}
                    </CardTitle>
                    <CardDescription>
                      {getStatusComponent(booking.status)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-semibold">{booking.date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-semibold">{booking.startTime}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <p className="font-bold">Rs. {booking.price}</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          disabled={cancellingId === booking.id}
                        >
                          {cancellingId === booking.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel your booking. This action cannot be
                            undone. Cancellation policies may apply.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleCancelBooking(booking.id, booking.slotId)
                            }
                          >
                            Proceed to Cancel
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              You have no upcoming bookings.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">History</h2>
          {pastBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastBookings.map((booking) => (
                <Card key={booking.id} className="opacity-80">
                  <CardHeader>
                    <CardTitle>
                      {venues[booking.venueId]?.name || "Venue loading..."}
                    </CardTitle>
                    <CardDescription>
                      {getStatusComponent(booking.status)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-semibold">{booking.date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-semibold">{booking.startTime}</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" disabled>
                      Download Invoice
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Your booking history is empty.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserBookingsPage;
