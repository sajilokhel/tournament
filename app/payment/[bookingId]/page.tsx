"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { expireBooking, cancelBooking } from "@/app/actions/bookings";
import { initiateEsewaPayment } from "@/lib/esewa/initiate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PaymentPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();

  const bookingId =
    typeof params?.bookingId === "string" ? params.bookingId : null;

  const [booking, setBooking] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle booking expiration by releasing hold
  const handleBookingExpiration = useCallback(
    async (bookingId: string) => {
      try {
        if (!user) return;
        const token = await user.getIdToken();
        
        const result = await expireBooking(token, bookingId);
        
        if (!result.success) {
          console.error("Failed to expire booking:", result.error);
          // Don't show error to user if it's just a cleanup task, 
          // but here it affects UI state.
        }

        setError("Your hold on this slot has expired.");
        setBooking((prev: any) => ({ ...prev, status: "EXPIRED" }));
        toast.error("Booking expired. The slot has been released.");
      } catch (e) {
        console.error("Error expiring booking:", e);
        setError(
          "There was an issue releasing the slot. Please refresh the page."
        );
      }
    },
    [user]
  );

    const handleCancelHold = useCallback(async () => {
      if (!user || !bookingId) return;
      setIsProcessing(true);
      try {
        const token = await user.getIdToken();
        const result = await cancelBooking(token, bookingId);
        if (!result.success) {
          toast.error(result.error || "Failed to cancel booking");
          setIsProcessing(false);
          return;
        }

        toast.success("Booking cancelled and hold released.");
        // Redirect to user's bookings and highlight the booking card
        router.push(`/user/bookings?highlight=${bookingId}`);
      } catch (err: any) {
        console.error('Error cancelling booking hold:', err);
        toast.error(err?.message || 'Failed to cancel booking.');
      } finally {
        setIsProcessing(false);
      }
    }, [user, bookingId, router]);

  useEffect(() => {
    if (!bookingId) {
      console.log("❌ Waiting for bookingId from params...");
      return;
    }

    let isMounted = true;

    const fetchBookingDetails = async () => {
      console.log("🔍 Fetching booking details for bookingId:", bookingId);
      try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
          console.log("❌ No such booking document!");
          setError("Booking not found.");
          setLoading(false);
          return;
        }

        console.log("✅ Booking document found:", bookingSnap.data());
        const bookingData = { id: bookingSnap.id, ...bookingSnap.data() };

        // Ensure server-computed amounts are present.
        if (bookingData.advanceAmount == null) {
          setError(
            'Booking is missing server-computed payment amounts. Please contact support or refresh.'
          );
          setLoading(false);
          return;
        }

        setBooking(bookingData);

        if (!isMounted) return;

        const venueRef = doc(db, "venues", bookingData.venueId);
        const venueSnap = await getDoc(venueRef);

        if (venueSnap.exists()) {
          setVenue(venueSnap.data());
        }

        if (
          bookingData.status === "pending_payment" &&
          bookingData.holdExpiresAt
        ) {
          const now = Timestamp.now();
          const remaining = bookingData.holdExpiresAt.seconds - now.seconds;

          if (remaining > 0) {
            console.log(`⏱️ Time left: ${remaining}s`);
            setTimeLeft(remaining);
          } else {
            console.log("⚠️ Hold expired, calling handleBookingExpiration");
            handleBookingExpiration(bookingId);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching booking details:", err);
        setError("Failed to load booking details.");
        setLoading(false);
      }
    };    fetchBookingDetails();

    return () => {
      isMounted = false;
    };
  }, [bookingId, handleBookingExpiration]); // Only depend on bookingId and the stable callback

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) {
      if (timeLeft === 0 && booking?.status === "pending_payment") {
        handleBookingExpiration(bookingId!);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime === null) return null;
        if (prevTime <= 1) return 0;
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, booking, bookingId, handleBookingExpiration]);

  const handleConfirmPayment = async () => {
    if (!user || !booking || !bookingId) return;
    setIsProcessing(true);

    try {
      // Use server-stored advance amount. Do NOT compute locally.
      if (booking.advanceAmount == null) {
        throw new Error('Missing server-calculated advance amount for this booking.');
      }

      // Initiate eSewa payment. Server will use the booking's stored amounts.
      await initiateEsewaPayment(bookingId);
      
      // Note: User will be redirected to eSewa, so code after this won't execute
      // Success/failure callbacks will handle the rest
    } catch (error: any) {
      console.error("Payment initiation error:", error);
      toast.error(error.message || "Failed to initiate payment. Please try again.");
      setIsProcessing(false);
    }
  };

  if (!bookingId || loading) {
    return (
      <div className="container mx-auto p-4 flex flex-col justify-center items-center h-screen gap-4">
        <Loader2 className="animate-spin h-8 w-8" />
        <p>Loading booking details...</p>
        {bookingId && (
          <p className="text-xs text-muted-foreground">
            Booking ID: {bookingId}
          </p>
        )}
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto p-4 flex flex-col justify-center items-center h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Booking Error</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {error || "Could not load booking information."}
        </p>
        <div className="flex gap-4">
          <Button
            onClick={() =>
              router.push(
                booking?.venueId ? `/venue/${booking.venueId}` : "/venues"
              )
            }
          >
            Find Another Slot
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  const isExpired =
    booking.status !== "pending_payment" ||
    (timeLeft !== null && timeLeft <= 0);
  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const seconds = timeLeft !== null ? timeLeft % 60 : 0;

  return (
    <div className="container mx-auto p-4 max-w-2xl pt-24">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Your Booking</CardTitle>
          <CardDescription>
            You have a limited time to confirm your booking before the slot is
            released.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {venue && (
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{venue.name}</h3>
              <p className="text-muted-foreground">{venue.address}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-semibold">{booking.date}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time</p>
              <p className="font-semibold">
                {booking.startTime} - {booking.endTime}
              </p>
            </div>
          </div>
          <div className="border bg-muted rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Total Price</p>
              <p className="font-semibold">Rs. {booking.amount || booking.price || 0}</p>
            </div>
            
            <div className="flex justify-between items-center text-primary">
              <div className="flex flex-col">
                <p className="font-semibold">Advance Payment (16.6%)</p>
                <p className="text-xs text-muted-foreground">To confirm booking</p>
              </div>
              <p className="text-xl font-bold">
                Rs. {booking.advanceAmount}
              </p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-muted-foreground">Due Amount</p>
              <p className="font-semibold">
                Rs. {booking.dueAmount}
              </p>
            </div>
            <p className="text-xs text-center text-muted-foreground bg-gray-100 dark:bg-gray-800 p-2 rounded">
              The due amount needs to be paid at the venue.
            </p>
          </div>

          {!isExpired ? (
            <div className="flex items-center justify-center p-4 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg">
              <Clock className="h-5 w-5 mr-3" />
              <p className="font-semibold">
                Time left to confirm: {minutes}:
                {seconds.toString().padStart(2, "0")}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center p-4 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 mr-3" />
              <p className="font-semibold">
                Your hold has expired. Please book again.
              </p>
            </div>
          )}
        </CardContent>
          <CardFooter className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={handleCancelHold}
            disabled={isProcessing}
            title="Cancel this booking and release the hold"
          >
            Cancel Hold
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={isProcessing || isExpired}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
            {isExpired ? "Hold Expired" : `Pay Advance Rs. ${booking.advanceAmount}`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PaymentPage;
