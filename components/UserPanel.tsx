"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Clock, Shield, Users } from "lucide-react";
import UserGuard from "@/components/UserGuard";
import VenueGallery from "@/components/VenueGallery";
import VenueHeader from "@/components/VenueHeader";
import VenueDetails from "@/components/VenueDetails";
import ReviewsSection from "@/components/ReviewsSection";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";
import RatingModal from "@/components/RatingModal";
import VenueLocationMap from "@/components/VenueLocationMap";
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
          <div className="space-y-6">
            <VenueHeader
              venueId={id as string}
              name={venue.name}
              pricePerHour={venue.pricePerHour}
              address={venue.address}
            />

            {/* Booking Section */}
            <Card className="shadow-lg border-2 border-blue-100 pt-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="text-xl flex items-center gap-2 py-4">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Book Your Slot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" size="lg">
                      <Clock className="w-4 h-4 mr-2" />
                      View All Available Slots
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">Available Time Slots</DialogTitle>
                    </DialogHeader>
                    <WeeklySlotsGrid groundId={id as string} />
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Shield className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="text-xs font-semibold text-gray-700">Verified Venue</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="text-xs font-semibold text-gray-700">Instant Booking</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="text-xs font-semibold text-gray-700">Popular Choice</p>
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
