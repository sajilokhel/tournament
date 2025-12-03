"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Clock, Shield, Users, Trophy, Star } from "lucide-react";
import UserGuard from "@/components/UserGuard";
import VenueGallery from "@/components/VenueGallery";
import VenueHeader from "@/components/VenueHeader";
import VenueDetails from "@/components/VenueDetails";
import ReviewsSection from "@/components/ReviewsSection";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";
import RatingModal from "@/components/RatingModal";
import { LocationPermissionBanner } from "@/components/LocationPermissionBanner";
import dynamic from "next/dynamic";

const VenueLocationMap = dynamic(
  () => import("@/components/VenueLocationMap"),
  { ssr: false }
);
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface Booking {
  id: string;
  venueId: string;
  userId: string;
  timeSlot: string;
  status: string;
  createdAt: any;
  rated?: boolean;
}

interface UserPanelProps {
  venue: any;
}

const UserPanel = ({ venue }: UserPanelProps) => {
  const { id } = useParams();
  const { user } = useAuth();
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);
  const [currentReview, setCurrentReview] = useState<{
    rating?: number;
    review?: string;
  }>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showLocationBanner, setShowLocationBanner] = useState(false);

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) return;

    // Check permission status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation([
                position.coords.latitude,
                position.coords.longitude,
              ]);
            },
            (error) => {
              console.error("Error getting location", error);
            }
          );
        } else if (result.state === "prompt") {
          setShowLocationBanner(true);
        }
      });
    } else {
      setShowLocationBanner(true);
    }
  }, []);

  const handleLocationGranted = (location: [number, number]) => {
    setUserLocation(location);
  };

  useEffect(() => {
    const checkForUnratedBookings = async () => {
      if (!user || !id) return;

      try {
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("userId", "==", user.uid),
          where("venueId", "==", id),
          where("status", "==", "completed"),
          where("rated", "!=", true)
        );

        const querySnapshot = await getDocs(bookingsQuery);
        if (!querySnapshot.empty) {
          const booking = querySnapshot.docs[0].data() as Booking;
          setBookingToRate({ ...booking, id: querySnapshot.docs[0].id });

          const reviewDocRef = doc(db, "reviews", `${id}_${user.uid}`);
          const reviewDocSnap = await getDoc(reviewDocRef);
          if (reviewDocSnap.exists()) {
            setCurrentReview({
              rating: reviewDocSnap.data().rating,
              review: reviewDocSnap.data().comment,
            });
          }

          setIsRatingModalOpen(true);
        }
      } catch (error) {
        console.error("Error checking for unrated bookings:", error);
      }
    };

    checkForUnratedBookings();
  }, [user, id]);

  const handleCloseRatingModal = () => {
    setIsRatingModalOpen(false);
    setBookingToRate(null);
  };

  return (
    <UserGuard>
      {showLocationBanner && (
        <LocationPermissionBanner
          onPermissionGranted={handleLocationGranted}
          onPermissionDenied={() => {}}
          onDismiss={() => setShowLocationBanner(false)}
        />
      )}
      <div className="max-w-7xl mx-auto">
        {bookingToRate && (
          <RatingModal
            bookingId={bookingToRate.id}
            venueId={id as string}
            userId={user!.uid}
            isOpen={isRatingModalOpen}
            onClose={handleCloseRatingModal}
            currentRating={currentReview.rating}
            currentReview={currentReview.review}
          />
        )}

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
          {/* Left: Gallery */}
          <div className="lg:sticky lg:top-8 h-fit">
            <VenueGallery
              imageUrls={venue.imageUrls || []}
              venueName={venue.name}
            />
          </div>

          {/* Right: Header, Booking, Quick Info */}
          <div className="space-y-8">
              <VenueHeader
                venueId={id as string}
                name={venue.name}
                pricePerHour={venue.pricePerHour}
                address={venue.address}
                averageRating={venue.averageRating}
                reviewCount={venue.reviewCount}
              />

            {/* Booking Section - Enhanced */}
            <Card className="shadow-xl border-0 ring-1 ring-gray-200 overflow-hidden bg-white">
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Ready to Play?</h3>
                    <p className="text-sm text-muted-foreground">Secure your spot on the field now.</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-sm text-muted-foreground mb-1">Price</div>
                    <div className="font-semibold text-lg">Rs. {venue.pricePerHour}<span className="text-sm font-normal text-muted-foreground">/hr</span></div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <div className="font-semibold text-lg text-orange-600 flex items-center gap-1">
                      <span className="relative flex h-2.5 w-2.5 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                      </span>
                      Open
                    </div>
                  </div>
                </div>

                <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" size="lg">
                      <Calendar className="w-5 h-5 mr-2" />
                      Check Available Slots
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold">Select a Time Slot</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <WeeklySlotsGrid groundId={id as string} />
                    </div>
                  </DialogContent>
                </Dialog>

                <p className="text-xs text-center text-muted-foreground">
                  Instant confirmation • Secure payment via eSewa
                </p>
              </CardContent>
            </Card>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <Shield className="w-8 h-8 mb-3 text-orange-500" />
                <p className="font-semibold text-sm text-gray-900">Verified</p>
                <p className="text-xs text-muted-foreground mt-1">Official Venue</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <Clock className="w-8 h-8 mb-3 text-gray-500" />
                <p className="font-semibold text-sm text-gray-900">Instant</p>
                <p className="text-xs text-muted-foreground mt-1">Real-time Booking</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <Star className="w-8 h-8 mb-3 text-orange-400" />
                <p className="font-semibold text-sm text-gray-900">Top Rated</p>
                <p className="text-xs text-muted-foreground mt-1">Community Favorite</p>
              </div>
            </div>
          </div>
        </div>

        <div className="my-12 border-t" />

        {/* Details Section - Full Width */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Venue Details</h2>
          <VenueDetails
            description={venue.description}
            attributes={venue.attributes}
          />
        </div>

        <div className="my-12 border-t" />

        {/* Location Map */}
        {venue.latitude && venue.longitude && (
          <>
            <div>
              <VenueLocationMap
                latitude={venue.latitude}
                longitude={venue.longitude}
                venueName={venue.name}
                address={venue.address}
                userLocation={userLocation}
              />
            </div>
            <div className="my-12 border-t" />
          </>
        )}

        {/* Reviews Section - Full Width */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
          <ReviewsSection venueId={id as string} />
        </div>
      </div>
    </UserGuard>
  );
};

export default UserPanel;
