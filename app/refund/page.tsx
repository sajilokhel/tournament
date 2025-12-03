import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MessageSquare, ArrowLeft } from "lucide-react";

interface Props {
  searchParams?: { bookingId?: string };
}

export default function RefundPage({ searchParams }: Props) {
  const bookingId = searchParams?.bookingId;

  // Placeholder contact details — update as needed in production
  const phone = "+977-9812345678";
  const whatsappNumber = "9779812345678"; // without + for wa.me
  const email = "support@example.com";

  return (
    <div className="container mx-auto px-4 pt-24 pb-8 max-w-3xl">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-orange-50 text-orange-600 p-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Refund & Cancellation</CardTitle>
              <CardDescription className="text-muted-foreground">
                We're here to help — reach out and we'll assist with your refund request.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-4">
          {bookingId && (
            <div className="bg-muted/60 p-3 rounded text-sm">
              <strong>Booking ID:</strong> {bookingId}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            To request a refund, please contact our support team using one of the options below. Include your booking ID and a short note about the reason for refund to speed up processing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="block">
              <div className="border rounded p-4 hover:shadow-md h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded text-primary">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Call Us</div>
                    <div className="text-xs text-muted-foreground">{phone}</div>
                  </div>
                </div>
              </div>
            </a>

            <a href={`mailto:${email}`} className="block">
              <div className="border rounded p-4 hover:shadow-md h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Email</div>
                    <div className="text-xs text-muted-foreground">{email}</div>
                  </div>
                </div>
              </div>
            </a>

            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="block">
              <div className="border rounded p-4 hover:shadow-md h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded text-primary">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">WhatsApp</div>
                    <div className="text-xs text-muted-foreground">+{whatsappNumber}</div>
                  </div>
                </div>
              </div>
            </a>
          </div>

          <div className="text-xs text-muted-foreground">
            Note: This page only provides contact options. Refund processing is handled manually by support and may take a few business days.
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Link href="/user/bookings" className="inline-block">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bookings
            </Button>
          </Link>

          <a href={`mailto:${email}?subject=Refund%20Request%20${bookingId ? bookingId : ""}`}>
            <Button>Contact Support</Button>
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
