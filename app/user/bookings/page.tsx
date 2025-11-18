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
  Timestamp,
} from "firebase/firestore";
import { unbookSlot, releaseHold } from "@/lib/slotService";
import { generateInvoice } from "@/lib/generateInvoice";
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
  Download,
  RefreshCw,
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
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

        // Check and expire held bookings that are past their hold time
        const now = Timestamp.now();
        const expiredPromises = bookingsData
          .filter((b) => {
            const statusLower = b.status.toLowerCase();
            if (statusLower === "pending_payment" && b.holdExpiresAt) {
              return b.holdExpiresAt.seconds < now.seconds;
            }
            return false;
          })
          .map(async (booking) => {
            try {
              const bookingRef = doc(db, "bookings", booking.id);
              await updateDoc(bookingRef, {
                status: "expired",
                expiredAt: serverTimestamp(),
              });

              // Release the hold from venueSlots
              await releaseHold(booking.venueId, booking.date, booking.startTime);

              return { ...booking, status: "expired" };
            } catch (error) {
              console.error("Error expiring booking:", booking.id, error);
              return booking;
            }
          });

        const expiredResults = await Promise.all(expiredPromises);

        // Update bookings data with expired status
        const updatedBookingsData = bookingsData.map((booking) => {
          const expired = expiredResults.find((e) => e.id === booking.id);
          return expired || booking;
        });

        // Fetch venue details for each booking
        const venueIds = [...new Set(updatedBookingsData.map((b) => b.venueId))];
        const venuePromises = venueIds.map((id) =>
          getDoc(doc(db, "venues", id as string))
        );
        const venueDocs = await Promise.all(venuePromises);
        const venuesMap = venueDocs.reduce((acc, doc) => {
          if (doc.exists()) acc[doc.id] = doc.data();
          return acc;
        }, {});

        setBookings(updatedBookingsData);
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

  const handleDownloadInvoice = async (booking: any) => {
    setDownloadingId(booking.id);
    try {
      const venue = venues[booking.venueId];
      if (!venue || !user) {
        toast.error("Unable to generate invoice. Missing data.");
        return;
      }

      generateInvoice({
        bookingId: booking.id,
        venueName: venue.name,
        venueAddress: venue.address || "Address not available",
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount: booking.amount || booking.price || 0,
        status: booking.status,
        userName: user.displayName || user.email || "Customer",
        userEmail: user.email || "Not available",
        paymentTimestamp: booking.paymentTimestamp,
        esewaTransactionCode: booking.esewaTransactionCode,
      });

      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerifyPaymentStatus = async (booking: any) => {
    setVerifyingId(booking.id);
    try {
      console.log("🔍 Verifying payment status for booking:", booking.id);

      // Call the verification API (server will handle booking confirmation)
      const verifyResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionUuid: booking.id,
          productCode: "EPAYTEST", // TODO: Get from env
          totalAmount: booking.amount || booking.price || 0,
        }),
      });

      const verificationData = await verifyResponse.json();
      console.log("✅ Verification response:", verificationData);

      if (verificationData.verified && verificationData.status === "COMPLETE") {
        if (verificationData.alreadyConfirmed) {
          toast.info("Booking is already confirmed.");
        } else if (verificationData.bookingConfirmed) {
          toast.success("Payment verified! Booking confirmed.");
          
          // Refresh bookings to get updated status
          const q = query(
            collection(db, "bookings"),
            where("userId", "==", user?.uid),
            orderBy("createdAt", "desc")
          );
          const querySnapshot = await getDocs(q);
          const bookingsData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setBookings(bookingsData);
        } else {
          toast.success("Payment verified.");
        }
      } else if (verificationData.status === "PENDING") {
        toast.info("Payment is still pending. Please try again later.");
      } else if (verificationData.status === "NOT_FOUND" || verificationData.status === "CANCELED") {
        toast.error("Payment not found or was cancelled.");
      } else {
        toast.warning(`Payment status: ${verificationData.status}`);
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast.error("Failed to verify payment status. Please try again.");
    } finally {
      setVerifyingId(null);
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
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
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
      className={`hover:shadow-lg transition-shadow ${highlightedBookingId === booking.id
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
          <CardFooter className="pt-4 flex flex-col gap-2">
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleDownloadInvoice(booking)}
                disabled={downloadingId === booking.id}
              >
                {downloadingId === booking.id ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Invoice
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleVerifyPaymentStatus(booking)}
                disabled={verifyingId === booking.id}
                title="Verify payment status with eSewa"
              >
                {verifyingId === booking.id ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verify
                  </>
                )}
              </Button>
            </div>
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => router.push(`/venue/${booking.venueId}`)}
              >
                View Venue
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    disabled={cancellingId === booking.id}
                  >
                    {cancellingId === booking.id ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Cancelling...
                      </>
                    ) : (
                      "Cancel"
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
              </div>
          </CardFooter>
        </>
      )}

      {!showActions && booking.status.toLowerCase() === "confirmed" && (
        <>
          <Separator />
          <CardFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleDownloadInvoice(booking)}
              disabled={downloadingId === booking.id}
            >
              {downloadingId === booking.id ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </>
              )}
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
            Complete your payment before the hold expires
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPayment.map((booking) => {
              const holdExpiresAt = booking.holdExpiresAt;
              const now = Timestamp.now();
              const timeLeftSeconds = holdExpiresAt ? holdExpiresAt.seconds - now.seconds : 0;
              const timeLeftMinutes = Math.floor(timeLeftSeconds / 60);
              const isExpiringSoon = timeLeftSeconds < 120 && timeLeftSeconds > 0;

              return (
                <Card
                  key={booking.id}
                  className={`border-yellow-200 ${isExpiringSoon
                      ? 'bg-red-50 dark:bg-red-950/10 border-red-300'
                      : 'bg-yellow-50 dark:bg-yellow-950/10'
                    }`}
                >
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
                    {holdExpiresAt && timeLeftSeconds > 0 && (
                      <div className={`text-xs flex items-center gap-1 ${isExpiringSoon ? 'text-red-600 font-semibold' : 'text-yellow-700'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {timeLeftMinutes > 0
                          ? `Hold expires in ${timeLeftMinutes} minute${timeLeftMinutes !== 1 ? 's' : ''}`
                          : `Hold expires in ${timeLeftSeconds} seconds`}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/payment/${booking.id}`)}
                    >
                      Complete Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleVerifyPaymentStatus(booking)}
                      disabled={verifyingId === booking.id}
                    >
                      {verifyingId === booking.id ? (
                        <>
                          <Loader2 className="animate-spin w-4 h-4 mr-2" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Check Payment Status
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
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
          <p className="text-sm text-muted-foreground mb-4">
            If payment was successful but booking shows as expired, use "Verify Payment" to check status
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cancelledOrExpired.map((booking) => (
              <Card key={booking.id} className="opacity-70">
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
                    <strong>Amount:</strong> Rs. {booking.amount || booking.price || 0}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleVerifyPaymentStatus(booking)}
                    disabled={verifyingId === booking.id}
                  >
                    {verifyingId === booking.id ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Verify Payment
                      </>
                    )}
                  </Button>
                </CardFooter>
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
