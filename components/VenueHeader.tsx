"use client";

import { Star, MapPin, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";

interface VenueHeaderProps {
  venueId: string;
  name: string;
  pricePerHour: number;
  address?: string;
}

interface Review {
  rating: number;
}

const VenueHeader = ({
  venueId,
  name,
  pricePerHour,
  address,
}: VenueHeaderProps) => {
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, "reviews"),
          where("venueId", "==", venueId)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const reviews = querySnapshot.docs.map((doc) => doc.data() as Review);
          const avgRating =
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          setAverageRating(Math.round(avgRating * 10) / 10);
          setReviewCount(reviews.length);

          // Calculate rating breakdown
          const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          reviews.forEach((r) => {
            breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
          });
          setRatingBreakdown(breakdown);
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, [venueId]);

  const renderStars = (rating: number, size: "sm" | "lg" = "sm") => {
    const sizeClass = size === "lg" ? "w-6 h-6" : "w-4 h-4";
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`${sizeClass} ${
          i < Math.floor(rating)
            ? "text-yellow-400 fill-yellow-400"
            : i < rating
            ? "text-yellow-400 fill-yellow-200"
            : "text-gray-300"
        }`}
      />
    ));
  };

  const soldCount = Math.floor(Math.random() * 500) + 100; // Mock data

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Category */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="hover:text-blue-600 cursor-pointer">Home</span>
        <span>/</span>
        <span className="hover:text-blue-600 cursor-pointer">Venues</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">{name}</span>
      </div>

      {/* Venue Name */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-2">
          {name}
        </h1>
        {address && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{address}</span>
          </div>
        )}
      </div>

      {/* Rating Section */}
      <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-gray-200">
        {isLoading ? (
          <div className="text-gray-400 text-sm">Loading ratings...</div>
        ) : averageRating !== null ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {renderStars(averageRating, "lg")}
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {averageRating}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-300" />
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{reviewCount}</span> Reviews
            </div>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span><span className="font-semibold text-gray-900">{soldCount}</span> Booked</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="flex gap-0.5">
              {renderStars(0)}
            </div>
            <span className="text-sm">No reviews yet</span>
          </div>
        )}
      </div>

      {/* Price Section - Product Page Style */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-4xl font-bold text-gray-900">
            Rs. {pricePerHour.toLocaleString()}
          </span>
          <span className="text-lg text-gray-600 font-medium">/hour</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            <Clock className="w-3 h-3 mr-1" />
            Available Now
          </Badge>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Instant Booking
          </Badge>
        </div>
      </div>

      {/* Rating Breakdown (Collapsible) */}
      {averageRating !== null && reviewCount > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center justify-between">
            <span>Rating Breakdown</span>
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-3 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-6">{star}★</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full rounded-full transition-all"
                    style={{
                      width: `${reviewCount > 0 ? (ratingBreakdown[star] / reviewCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-8 text-right">
                  {ratingBreakdown[star]}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default VenueHeader;
