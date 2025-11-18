"use client";

/**
 * Payment Success Page
 * 
 * This page is displayed after successful payment from eSewa.
 * It verifies the transaction and updates the booking status.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { bookSlot } from "@/lib/slotService";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    verifyAndConfirmPayment();
  }, []);

  const verifyAndConfirmPayment = async () => {
    try {
      // Get eSewa response - they send Base64 encoded data in 'data' parameter
      const encodedData = searchParams.get("data");
      console.log("📦 Encoded data:", encodedData);
      
      if (!encodedData) {
        setStatus("error");
        setMessage("Invalid payment response. Missing transaction data.");
        return;
      }

      // Decode Base64 response
      let responseData: any;
      try {
        const decodedString = atob(encodedData);
        console.log("🔓 Decoded string:", decodedString);
        responseData = JSON.parse(decodedString);
        console.log("📋 Parsed response data:", responseData);
      } catch (e) {
        console.error("❌ Error decoding eSewa response:", e);
        setStatus("error");
        setMessage("Invalid payment response format.");
        return;
      }

      // Extract transaction details from decoded data
      const transactionUuid = responseData.transaction_uuid;
      const productCode = responseData.product_code;
      const transactionCode = responseData.transaction_code;
      const esewaStatus = responseData.status;
      const totalAmount = responseData.total_amount;

      console.log("🔍 Extracted data:", {
        transactionUuid,
        productCode,
        transactionCode,
        esewaStatus,
        totalAmount,
      });

      if (!transactionUuid || !productCode) {
        setStatus("error");
        setMessage("Invalid payment response. Missing transaction details.");
        return;
      }

      // Check if eSewa reported success
      if (esewaStatus !== "COMPLETE") {
        setStatus("error");
        setMessage(`Payment not completed. Status: ${esewaStatus}`);
        return;
      }

      setBookingId(transactionUuid);

      console.log("🔐 Verifying payment with eSewa API...");
      // Verify payment with eSewa
      const verifyResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionUuid,
          productCode,
          totalAmount, // Pass the total amount for verification
        }),
      });

      const verificationData = await verifyResponse.json();
      console.log("✅ Verification response:", verificationData);

      if (!verificationData.verified || verificationData.status !== "COMPLETE") {
        console.warn("⚠️ Verification failed:", verificationData);
        setStatus("error");
        setMessage(
          `Payment verification failed. Status: ${verificationData.status || "Unknown"}`
        );
        return;
      }

      console.log("📝 Getting booking document...");
      // Get booking details
      const bookingRef = doc(db, "bookings", transactionUuid);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        console.error("❌ Booking not found:", transactionUuid);
        setStatus("error");
        setMessage("Booking not found. Please contact support.");
        return;
      }

      const booking = bookingSnap.data();
      console.log("📄 Booking data:", booking);

      console.log("🔄 Converting hold to confirmed booking...");
      // Convert hold to confirmed booking in venueSlots
      await bookSlot(booking.venueId, booking.date, booking.startTime, {
        bookingId: transactionUuid,
        bookingType: "website",
        status: "confirmed",
        userId: booking.userId,
      });

      console.log("💾 Updating booking document...");
      // Update booking document
      await updateDoc(bookingRef, {
        status: "confirmed",
        paymentTimestamp: serverTimestamp(),
        esewaTransactionCode: transactionCode,
        esewaTransactionUuid: transactionUuid,
        esewaStatus: esewaStatus,
        esewaAmount: totalAmount,
      });

      console.log("🎉 Payment confirmed successfully!");
      setStatus("success");
      setMessage("Payment successful! Your booking has been confirmed.");
    } catch (error) {
      console.error("❌ Error verifying payment:", error);
      setStatus("error");
      setMessage("An error occurred while verifying your payment. Please contact support.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === "verifying" && (
              <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            )}
            {status === "error" && <XCircle className="h-16 w-16 text-red-500" />}
          </div>
          <CardTitle className="text-2xl">
            {status === "verifying" && "Processing Payment"}
            {status === "success" && "Payment Successful!"}
            {status === "error" && "Payment Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && (
            <>
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription>
                  Your booking has been confirmed. You will receive a confirmation email shortly.
                </AlertDescription>
              </Alert>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push(`/user/bookings?highlight=${bookingId}`)}>
                  View My Bookings
                </Button>
                <Button variant="outline" onClick={() => router.push("/venues")}>
                  Browse More Venues
                </Button>
              </div>
            </>
          )}

          {status === "error" && (
            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push(`/payment/${bookingId}`)}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => router.push("/user/bookings")}>
                My Bookings
              </Button>
            </div>
          )}

          {status === "verifying" && (
            <Alert>
              <AlertDescription>
                Please wait while we verify your payment with eSewa. This may take a few moments.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
