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
import { releaseHold } from "@/lib/slotService";
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
    async (bookingId: string, venueId: string, date: string, startTime: string) => {
      try {
        const bookingRef = doc(db, "bookings", bookingId);

        await updateDoc(bookingRef, {
          status: "EXPIRED",
          expiredAt: serverTimestamp(),
        });

        // Release the hold (cleanup happens automatically in slotService)
        await releaseHold(venueId, date, startTime);

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
    []
  ); // No dependencies needed

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
            handleBookingExpiration(
              bookingId,
              bookingData.venueId,
              bookingData.date,
              bookingData.startTime
            );
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
        handleBookingExpiration(
          bookingId!,
          booking.venueId,
          booking.date,
          booking.startTime
        );
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
      // Initiate eSewa payment
      // This will redirect the user to eSewa payment gateway
      await initiateEsewaPayment(
        bookingId,
        booking.amount || booking.price || 0
      );
      
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
          <div className="border bg-muted rounded-lg p-4 space-y-2">
            <p className="text-muted-foreground">Total Price</p>
            <p className="text-3xl font-bold">Rs. {booking.amount || booking.price || 0}</p>
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
            onClick={() => router.push(`/venue/${booking.venueId}`)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={isProcessing || isExpired}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
            {isExpired ? "Hold Expired" : "Confirm & Pay"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PaymentPage;
