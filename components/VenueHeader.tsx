"use client";

import { Star, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface VenueHeaderProps {
  venueId: string;
  name: string;
  pricePerHour: number;
  address?: string;
  averageRating?: number;
  reviewCount?: number;
}

const VenueHeader = ({
  venueId,
  name,
  pricePerHour,
  address,
  averageRating = 0,
  reviewCount = 0,
}: VenueHeaderProps) => {
  
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });

  // Optional: Fetch breakdown only if needed, or we can implement a more advanced 
  // storage for breakdown later. For now, let's just use the average.
  
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
        {reviewCount > 0 ? (
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
    </div>
  );
};

export default VenueHeader;
