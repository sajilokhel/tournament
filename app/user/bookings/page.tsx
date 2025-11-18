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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { unbookSlot } from "@/lib/slotService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  MapPin,
  Calendar as CalendarIcon,
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

  const handleCancelBooking = async (booking: any) => {
    setCancellingId(booking.id);
    try {
      // Update booking status
      const bookingRef = doc(db, "bookings", booking.id);
      await updateDoc(bookingRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });

      // Remove from venueSlots bookings array
      await unbookSlot(booking.venueId, booking.date, booking.startTime);

      // Update local state
      setBookings(
        bookings.map((b) =>
          b.id === booking.id ? { ...b, status: "cancelled" } : b
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

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case "confirmed":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge variant="warning" className="bg-yellow-500 hover:bg-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending Payment
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="bg-gray-500">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
          <p className="text-muted-foreground">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  // Categorize bookings
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const confirmedUpcoming = bookings.filter((b) => {
    const statusLower = b.status.toLowerCase();
    return statusLower === "confirmed" && b.date >= today;
  });
  
  const pendingPayment = bookings.filter((b) => {
    const statusLower = b.status.toLowerCase();
    return statusLower === "pending_payment";
  });
  
  const pastCompleted = bookings.filter((b) => {
    const statusLower = b.status.toLowerCase();
    return statusLower === "confirmed" && b.date < today;
  });
  
  const cancelledOrExpired = bookings.filter((b) => {
    const statusLower = b.status.toLowerCase();
    return statusLower === "cancelled" || statusLower === "expired";
  });

  const highlightedBookingId = searchParams.get("highlight");

  const renderBookingCard = (booking: any, showActions = false) => (
    <Card
      key={booking.id}
      className={`hover:shadow-lg transition-shadow ${
        highlightedBookingId === booking.id
          ? "ring-2 ring-primary shadow-lg"
          : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg">
              {venues[booking.venueId]?.name || "Loading venue..."}
            </CardTitle>
            {venues[booking.venueId]?.address && (
              <CardDescription className="flex items-center gap-1 text-xs">
                <MapPin className="w-3 h-3" />
                {venues[booking.venueId].address}
              </CardDescription>
            )}
          </div>
          {getStatusBadge(booking.status)}
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-4 pb-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              Date
            </p>
            <p className="font-semibold">{booking.date}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Time
            </p>
            <p className="font-semibold">
              {booking.startTime} - {booking.endTime}
            </p>
          </div>
        </div>
        
        <Separator className="my-3" />
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Amount</span>
          <span className="text-lg font-bold">
            Rs. {booking.amount || booking.price || 0}
          </span>
        </div>
      </CardContent>
      
      {showActions && (
        <>
          <Separator />
          <CardFooter className="pt-4 flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/venue/${booking.venueId}`)}
            >
              View Venue
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancellingId === booking.id}
                >
                  {cancellingId === booking.id ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Booking"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this booking? This action cannot be undone.
                    Please check our cancellation policy for any applicable fees.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleCancelBooking(booking)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </>
      )}
      
      {!showActions && booking.status.toLowerCase() === "confirmed" && (
        <>
          <Separator />
          <CardFooter className="pt-4">
            <Button variant="outline" size="sm" className="w-full" disabled>
              Download Invoice
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Pending Payment Section */}
      {pendingPayment.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h2 className="text-2xl font-bold">Action Required</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Complete your payment to confirm these bookings
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPayment.map((booking) => (
              <Card key={booking.id} className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {venues[booking.venueId]?.name || "Loading..."}
                  </CardTitle>
                  {getStatusBadge(booking.status)}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <strong>Date:</strong> {booking.date}
                  </p>
                  <p className="text-sm">
                    <strong>Time:</strong> {booking.startTime}
                  </p>
                  <p className="text-sm">
                    <strong>Amount:</strong> Rs. {booking.amount || booking.price}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/payment/${booking.id}`)}
                  >
                    Complete Payment
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Bookings Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h2 className="text-2xl font-bold">Upcoming Bookings</h2>
        </div>
        {confirmedUpcoming.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {confirmedUpcoming.map((booking) => renderBookingCard(booking, true))}
          </div>
        ) : (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No upcoming bookings</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => router.push("/venues")}
              >
                Browse Venues
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Past Completed Section */}
      {pastCompleted.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Completed</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastCompleted.map((booking) => renderBookingCard(booking, false))}
          </div>
        </div>
      )}

      {/* Cancelled/Expired Section */}
      {cancelledOrExpired.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Cancelled & Expired</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cancelledOrExpired.map((booking) => (
              <Card key={booking.id} className="opacity-60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {venues[booking.venueId]?.name || "Loading..."}
                  </CardTitle>
                  {getStatusBadge(booking.status)}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <strong>Date:</strong> {booking.date}
                  </p>
                  <p className="text-sm">
                    <strong>Time:</strong> {booking.startTime}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {bookings.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by exploring available venues and make your first booking.
            </p>
            <Button onClick={() => router.push("/venues")}>
              Browse Venues
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UserBookingsPage;
