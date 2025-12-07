"use client";

/**
 * Payment Success Page
 * 
 * This page is displayed after successful payment from eSewa.
 * It verifies the transaction and updates the booking status.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Home, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookingSummary } from "@/components/BookingSummary";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [venueDetails, setVenueDetails] = useState<any>(null);

  useEffect(() => {
    verifyAndConfirmPayment();
  }, []);

  const fetchBookingDetails = async (id: string) => {
    try {
      const bookingDoc = await getDoc(doc(db, "bookings", id));
      if (bookingDoc.exists()) {
        const data = bookingDoc.data();
        setBookingDetails(data);
        
        // Fetch venue details too
        if (data.venueId) {
          const venueDoc = await getDoc(doc(db, "venues", data.venueId));
          if (venueDoc.exists()) {
            setVenueDetails(venueDoc.data());
          }
        }
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
    }
  };

  const verifyAndConfirmPayment = async () => {
    try {
      // Get eSewa response - they send Base64 encoded data in 'data' parameter
      const encodedData = searchParams.get("data");
      
      if (!encodedData) {
        setStatus("error");
        setMessage("Invalid payment response. Missing transaction data.");
        return;
      }

      // Decode Base64 response
      let responseData: any;
      try {
        const decodedString = atob(encodedData);
        responseData = JSON.parse(decodedString);
      } catch (e) {
        console.error("❌ Error decoding eSewa response:", e);
        setStatus("error");
        setMessage("Invalid payment response format.");
        return;
      }

      // Extract transaction details
      const transactionUuid = responseData.transaction_uuid;
      const productCode = responseData.product_code;
      const esewaStatus = responseData.status;
      const totalAmount = responseData.total_amount;

      if (!transactionUuid || !productCode) {
        setStatus("error");
        setMessage("Invalid payment response. Missing transaction details.");
        return;
      }

      setBookingId(transactionUuid);

      // Check if eSewa reported success
      if (esewaStatus !== "COMPLETE") {
        setStatus("error");
        setMessage(`Payment not completed. Status: ${esewaStatus}`);
        return;
      }

      // Verify payment with eSewa
      const verifyResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionUuid,
          productCode,
          totalAmount,
        }),
      });

      const verificationData = await verifyResponse.json();

      if (!verificationData.verified || verificationData.status !== "COMPLETE") {
        setStatus("error");
        const errorMsg = verificationData.details 
          ? `Payment verification failed: ${verificationData.details}`
          : `Payment verification failed. Status: ${verificationData.status || "Unknown"}`;
        setMessage(errorMsg);
        return;
      }

      // Success!
      setStatus("success");
      setMessage("Payment successful! Your booking has been confirmed.");

      // If server returned booking data, use it to populate the summary without
      // requiring a direct client Firestore read (which can be blocked by rules
      // if the user is not authenticated after redirect).
      if (verificationData.bookingData) {
        setBookingDetails(verificationData.bookingData);
        if (verificationData.bookingData.venueId) {
          // Optionally fetch venue details (venues reads are public per rules),
          // but guard with try/catch.
          try {
            const venueDoc = await getDoc(doc(db, "venues", verificationData.bookingData.venueId));
            if (venueDoc.exists()) setVenueDetails(venueDoc.data());
          } catch (e) {
            console.warn("Could not read venue details from client DB:", e);
          }
        }
      } else if (verificationData.bookingFound === false) {
        // Server verified the payment but booking document was not found.
        // Don't attempt a client Firestore read (it will fail if the user is not authenticated after redirect).
        console.warn('Payment verified but booking document not found on server');
      } else {
        // Fallback: attempt to read booking details from client Firestore (may fail if user not signed in)
        await fetchBookingDetails(transactionUuid);
      }

    } catch (error) {
      console.error("❌ Error verifying payment:", error);
      setStatus("error");
      setMessage("An error occurred while verifying your payment. Please contact support.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            {status === "verifying" && (
              <div className="relative">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-blue-50 p-4 rounded-full">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                </div>
              </div>
            )}
            {status === "success" && (
              <div className="relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                <div className="relative bg-green-50 p-4 rounded-full">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="bg-red-50 p-4 rounded-full">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
            )}
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900">
            {status === "verifying" && "Verifying Payment"}
            {status === "success" && "Booking Confirmed!"}
            {status === "error" && "Payment Failed"}
          </CardTitle>
          
          <p className="text-muted-foreground mt-2">
            {message}
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {status === "success" && bookingDetails && venueDetails && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BookingSummary
                venueName={venueDetails.name}
                address={venueDetails.address}
                date={bookingDetails.date}
                startTime={bookingDetails.startTime}
                endTime={bookingDetails.endTime}
                computed={{
                  baseAmount: bookingDetails.amount,
                  totalAmount: bookingDetails.amount,
                  advanceAmount: bookingDetails.advanceAmount,
                }}
                className="bg-white shadow-sm border-gray-200"
              />
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col gap-3 pt-2">
              <Button 
                className="w-full h-12 text-lg" 
                onClick={() => router.push(`/user/bookings?highlight=${bookingId}`)}
              >
                <Calendar className="w-5 h-5 mr-2" />
                View My Bookings
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12"
                onClick={() => router.push("/venues")}
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Home
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-3 pt-2">
              {bookingId && (
                <Button 
                  className="w-full h-12 text-lg"
                  onClick={() => router.push(`/payment/${bookingId}`)}
                >
                  Try Payment Again
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full h-12"
                onClick={() => router.push("/user/bookings")}
              >
                Go to My Bookings
              </Button>
            </div>
          )}

          {status === "verifying" && (
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertDescription className="text-center">
                Please do not close this window. We are confirming your transaction with eSewa.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
