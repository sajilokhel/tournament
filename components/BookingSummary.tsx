import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";

interface ComputedAmounts {
  baseAmount: number;
  advanceAmount: number;
  totalAmount: number;
}

interface BookingSummaryProps {
  venueName: string;
  address?: string;
  date: string;
  startTime: string;
  endTime: string;
  // Optional: when showing a preview before booking, pass `computed` OR
  // provide `venueId` + `date` + `startTime` to let the component fetch
  // authoritative computed amounts from the server.
  computed?: ComputedAmounts | null;
  venueId?: string;
  slots?: number;
  className?: string;
}

export function BookingSummary({
  venueName,
  address,
  date,
  startTime,
  endTime,
  computed = null,
  venueId,
  slots = 1,
  className,
}: BookingSummaryProps) {
  const [serverComputed, setServerComputed] = useState<ComputedAmounts | null>(computed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If computed was provided by parent, use it. Otherwise try to fetch
    // authoritative amounts from the server when venueId/date/startTime are present.
    if (computed) return;
    if (!venueId || !date || !startTime) {
      setError('Price not available. Provide server-computed amounts.');
      return;
    }

    let mounted = true;
    setLoading(true);
    fetch('/api/payment/compute-amount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, date, startTime, slots }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch computed amounts');
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (!data.computed) {
          setError('Server did not return computed amounts');
          return;
        }
        setServerComputed(data.computed as ComputedAmounts);
      })
      .catch((err) => {
        console.error('Error fetching computed amounts:', err);
        setError('Error fetching price preview from server.');
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [computed, venueId, date, startTime, slots]);
  return (
    <Card className={`overflow-hidden border-2 ${className}`}>
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Booking Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Venue Details */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{venueName}</h3>
          {address && (
            <div className="flex items-start gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{address}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              <span>Date</span>
            </div>
            <p className="font-medium">{date}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              <span>Time</span>
            </div>
            <p className="font-medium">
              {startTime} - {endTime}
            </p>
          </div>
        </div>

        <Separator />

        {/* Price Breakdown */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading price preview...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : serverComputed ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-lg font-bold">Rs. {serverComputed.totalAmount}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Advance Payment</span>
                <span className="text-sm font-semibold text-orange-600">Rs. {serverComputed.advanceAmount}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Due Amount</span>
                <span className="text-sm font-semibold text-red-600">Rs. {serverComputed.totalAmount - serverComputed.advanceAmount}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Price not available</div>
          )}

          <div className="bg-muted/50 p-3 rounded text-xs text-center text-muted-foreground">
            <strong>Note:</strong> Pay the advance now to confirm your booking. The due amount is to be paid after the game at the venue.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
