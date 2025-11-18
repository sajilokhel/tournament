"use client";

/**
 * Payment Failure Page
 * 
 * This page is displayed when payment fails or is cancelled by the user.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentFailurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactionUuid, setTransactionUuid] = useState<string | null>(null);

  useEffect(() => {
    const uuid = searchParams.get("transaction_uuid");
    setTransactionUuid(uuid);
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            Your payment could not be processed or was cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your booking hold is still active for a limited time. You can try again before it
              expires.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Common reasons for payment failure:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Payment was cancelled by you</li>
              <li>Insufficient balance in eSewa account</li>
              <li>Network connectivity issues</li>
              <li>Invalid payment credentials</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center pt-4">
            {transactionUuid && (
              <Button onClick={() => router.push(`/payment/${transactionUuid}`)}>
                Try Payment Again
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/venues")}>
              Browse Venues
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If you continue to experience issues, please contact our support team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
