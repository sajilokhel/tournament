import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface BookingSummaryProps {
  venueName: string;
  address?: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  className?: string;
}

export function BookingSummary({
  venueName,
  address,
  date,
  startTime,
  endTime,
  price,
  className,
}: BookingSummaryProps) {
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
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Amount</span>
            <span className="text-lg font-bold">Rs. {price}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Advance Payment</span>
            <span className="text-sm font-semibold text-orange-600">
              Rs. {Math.ceil((price * 16.6) / 100)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Due Amount</span>
            <span className="text-sm font-semibold text-red-600">
              Rs. {price - Math.ceil((price * 16.6) / 100)}
            </span>
          </div>
          
          <div className="bg-muted/50 p-3 rounded text-xs text-center text-muted-foreground">
            <strong>Note:</strong> Pay the advance now to confirm your booking. The due amount is to be paid after the game at the venue.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
