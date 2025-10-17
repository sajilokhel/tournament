"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { useUploadThing } from "@/lib/uploadthing-client";
import { onAuthStateChanged, User } from "firebase/auth";
import AuthGuard from "@/components/AuthGuard";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/**
 * Venue Detail - polished and unique design
 *
 * - Hero card with venue overview and prominent QR / booking CTA
 * - Fancy availability grid with slot cards and badges for status
 * - Dialog modal for booking flow that shows QR and upload input (uses UploadThing)
 * - Uses shadcn-style components for a cohesive look
 */

interface Venue {
  id: string;
  name: string;
  address?: string;
  facilities?: string;
  qrCode?: string;
}

interface Booking {
  id: string;
  timeSlot: string;
  status: string;
  userId: string;
  screenshotUrl?: string;
}

export default function VenueDetail() {
  const { id } = useParams();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const { startUpload, isUploading } = useUploadThing("imageUploader");

  const timeSlots = [
    "9:00 - 10:00",
    "10:00 - 11:00",
    "11:00 - 12:00",
    "12:00 - 13:00",
    "13:00 - 14:00",
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "venues", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setVenue({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Venue, "id">),
          });
        }

        const q = query(collection(db, "bookings"), where("venueId", "==", id));
        const snap = await getDocs(q);
        const bookingList = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as Booking[];
        setBookings(bookingList);
      } catch (err) {
        console.error("Failed to fetch venue/bookings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const isBooked = (slot: string) => {
    return bookings.some((b) => b.timeSlot === slot && b.status === "approved");
  };

  const handleOpenBooking = (slot: string) => {
    if (!user) {
      alert("Please sign in to book a slot.");
      return;
    }
    setSelectedSlot(slot);
    setScreenshot(null);
  };

  const handleSubmitBooking = async () => {
    if (!selectedSlot || !user || !venue) return;
    if (!screenshot) {
      alert("Please upload a screenshot of the payment before submitting.");
      return;
    }
    setUploading(true);
    try {
      const res = await startUpload([screenshot]);
      if (res && res[0]) {
        await addDoc(collection(db, "bookings"), {
          venueId: venue.id,
          userId: user.uid,
          timeSlot: selectedSlot,
          status: "pending",
          screenshotUrl: res[0].url,
          createdAt: new Date().toISOString(),
        });
        alert("Booking submitted. Manager will verify and approve.");
        setSelectedSlot(null);
        // refresh bookings list
        const q = query(collection(db, "bookings"), where("venueId", "==", id));
        const snap = await getDocs(q);
        const bookingList = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as Booking[];
        setBookings(bookingList);
      } else {
        alert("Upload failed. Try again.");
      }
    } catch (err) {
      console.error("Booking submission failed", err);
      alert("Failed to submit booking.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent>
              <div className="py-12 text-center text-muted-foreground">
                Loading venue…
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  if (!venue) {
    return (
      <AuthGuard>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent>
              <div className="py-12 text-center text-muted-foreground">
                Venue not found.
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Hero / Overview */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{venue.name}</h2>
                {venue.address && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {venue.address}
                  </p>
                )}
                {venue.facilities && (
                  <p className="text-sm mt-3 text-foreground/80">
                    {venue.facilities}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    Average rating
                  </div>
                  <div className="text-lg font-semibold">4.6 ★</div>
                </div>
                <Avatar>
                  <AvatarImage
                    src={venue.qrCode ?? undefined}
                    alt={venue.name}
                  />
                  <AvatarFallback>
                    {(venue.name ?? "V").charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="rounded-lg overflow-hidden bg-gradient-to-tr from-slate-50 to-white p-4">
                    <h3 className="text-sm font-medium mb-2">
                      About this venue
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {venue.facilities ?? "No additional details provided."}
                    </p>
                  </div>

                  <Separator className="my-4" />

                  <h4 className="text-sm font-medium mb-2">Availability</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {timeSlots.map((slot) => {
                      const booked = isBooked(slot);
                      return (
                        <div
                          key={slot}
                          className={`rounded-lg p-3 border flex flex-col justify-between ${
                            booked
                              ? "bg-red-50 border-red-200"
                              : "bg-white dark:bg-gray-900 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{slot}</div>
                            {booked ? (
                              <Badge variant="destructive">Booked</Badge>
                            ) : (
                              <Badge variant="secondary">Free</Badge>
                            )}
                          </div>

                          <div className="mt-3">
                            {!booked ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenBooking(slot)}
                              >
                                Book
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                Unavailable
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="w-full md:w-72">
                  <div className="sticky top-6">
                    <Card>
                      <CardContent>
                        <div className="text-sm text-muted-foreground mb-2">
                          Payment QR
                        </div>
                        <div className="w-full h-48 flex items-center justify-center bg-muted rounded-lg overflow-hidden">
                          {venue.qrCode ? (
                            <img
                              src={venue.qrCode}
                              alt="QR Code"
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No QR provided
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="text-sm text-muted-foreground">
                            Need help?
                          </div>
                          <div className="text-sm mt-2">
                            Upload your payment screenshot and our manager will
                            verify it.
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Dialog
                          open={!!selectedSlot}
                          onOpenChange={() => setSelectedSlot(null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="default" className="w-full">
                              Start Booking
                            </Button>
                          </DialogTrigger>

                          <DialogContent>
                            <DialogTitle>Book a slot</DialogTitle>
                            <DialogDescription>
                              You're booking a slot at {venue.name}. Please scan
                              the QR to pay and upload the payment screenshot
                              below.
                            </DialogDescription>

                            <div className="mt-4">
                              <div className="text-sm mb-2">Selected slot</div>
                              <div className="text-lg font-medium">
                                {selectedSlot ?? "—"}
                              </div>

                              <div className="mt-4">
                                <label className="text-sm block mb-2">
                                  Upload payment screenshot
                                </label>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null;
                                    setScreenshot(f);
                                  }}
                                />
                                <div className="mt-2 text-sm text-muted-foreground">
                                  {screenshot
                                    ? `Selected: ${screenshot.name}`
                                    : "No file chosen"}
                                </div>
                              </div>
                            </div>

                            <DialogFooter>
                              <div className="flex items-center gap-2 w-full">
                                <Button
                                  variant="outline"
                                  onClick={() => setSelectedSlot(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSubmitBooking}
                                  disabled={uploading || !screenshot}
                                >
                                  {uploading
                                    ? "Uploading…"
                                    : "Submit for approval"}
                                </Button>
                              </div>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardFooter>
                    </Card>

                    <div className="mt-4">
                      <Card>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            Manager
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>FM</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">
                                Futsal Manager
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Usually replies within 24h
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side panel: quick stats */}
          <div className="space-y-4">
            <Card>
              <CardContent>
                <div className="text-sm text-muted-foreground">Quick stats</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-slate-50 text-center">
                    <div className="text-sm text-muted-foreground">
                      Total bookings
                    </div>
                    <div className="text-lg font-semibold">
                      {bookings.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-slate-50 text-center">
                    <div className="text-sm text-muted-foreground">Pending</div>
                    <div className="text-lg font-semibold">
                      {bookings.filter((b) => b.status === "pending").length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="text-sm text-muted-foreground">Actions</div>
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // quick refresh
                      setLoading(true);
                      const q = query(
                        collection(db, "bookings"),
                        where("venueId", "==", id),
                      );
                      const snap = await getDocs(q);
                      setBookings(
                        snap.docs.map((d) => ({
                          id: d.id,
                          ...(d.data() as any),
                        })),
                      );
                      setLoading(false);
                    }}
                  >
                    Refresh Bookings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
