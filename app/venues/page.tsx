"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Star, Map, List, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { LocationPermissionBanner } from "@/components/LocationPermissionBanner";

const PublicVenueMap = dynamic(() => import("@/components/PublicVenueMap"), {
  ssr: false,
});

const VenueFilter = ({ setFilteredVenues, allVenues }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [amenities, setAmenities] = useState({
    parking: false,
    covered: false,
  });

  useEffect(() => {
    let filtered = allVenues;

    if (searchTerm) {
      filtered = filtered.filter((venue) =>
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (minRating > 0) {
      filtered = filtered.filter((venue) => venue.avgRating >= minRating);
    }

    if (amenities.parking) {
      filtered = filtered.filter((venue) => venue.amenities?.parking);
    }

    if (amenities.covered) {
      filtered = filtered.filter((venue) => venue.amenities?.covered);
    }

    setFilteredVenues(filtered);
  }, [searchTerm, minRating, amenities, allVenues, setFilteredVenues]);

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-background">
      <h3 className="text-lg font-semibold">Filter Venues</h3>
      <Input
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div>
        <label className="block text-sm font-medium mb-2">
          Minimum Rating:
        </label>
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`cursor-pointer h-5 w-5 ${
                minRating >= star
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }`}
              onClick={() => setMinRating(star)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMinRating(0)}
            className="ml-2"
          >
            Clear
          </Button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Amenities:</label>
        <div className="flex flex-col space-y-2">
          <label className="flex items-center gap-2 font-normal cursor-pointer">
            <input
              type="checkbox"
              checked={amenities.parking}
              onChange={(e) =>
                setAmenities({ ...amenities, parking: e.target.checked })
              }
              className="cursor-pointer"
            />
            Parking
          </label>
          <label className="flex items-center gap-2 font-normal cursor-pointer">
            <input
              type="checkbox"
              checked={amenities.covered}
              onChange={(e) =>
                setAmenities({ ...amenities, covered: e.target.checked })
              }
              className="cursor-pointer"
            />
            Covered Roof
          </label>
        </div>
      </div>
    </div>
  );
};

const VenueResultList = ({ venues, setSelectedVenue }) => {
  return (
    <div className="space-y-4 flex-1 overflow-y-auto">
      <div className="sticky top-0 bg-background py-2 z-10 border-b">
        <h3 className="text-lg font-semibold">
          Available Venues ({venues.length})
        </h3>
      </div>
      {venues.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No venues match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className="shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{venue.name}</CardTitle>
                <div className="flex items-center pt-1">
                  {venue.avgRating > 0 ? (
                    <>
                      <div className="flex items-center">
                        {[...Array(Math.floor(venue.avgRating))].map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 text-yellow-400 fill-yellow-400"
                          />
                        ))}
                        {[...Array(5 - Math.floor(venue.avgRating))].map(
                          (_, i) => (
                            <Star key={i} className="h-4 w-4 text-gray-300" />
                          ),
                        )}
                      </div>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {venue.avgRating.toFixed(1)} ({venue.ratingCount}{" "}
                        reviews)
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No ratings yet
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-muted-foreground">{venue.address}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-0">
                <Link href={`/venue/${venue.id}`}>
                  <Button variant="outline" size="sm">
                    See Details
                  </Button>
                </Link>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSelectedVenue(venue)}
                >
                  View on Map
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const VenuesPage = () => {
  const [allVenues, setAllVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    27.7172, 85.324,
  ]);
  const [mapZoom, setMapZoom] = useState(12);
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const handleLocationGranted = (location: [number, number]) => {
    // Validate location coordinates
    if (
      !location ||
      location.length !== 2 ||
      isNaN(location[0]) ||
      isNaN(location[1])
    ) {
      console.error("Invalid location coordinates:", location);
      return;
    }

    setUserLocation(location);
    setMapCenter(location);
    setMapZoom(14);
  };

  const handleLocationDenied = () => {
    // Keep default location (Kathmandu)
    console.log("User denied location access, using default location");
  };

  useEffect(() => {
    const fetchVenuesAndRatings = async () => {
      const venuesCollection = await getDocs(collection(db, "venues"));
      const venuesData = await Promise.all(
        venuesCollection.docs.map(async (doc) => {
          const venue = { id: doc.id, ...doc.data() };
          const ratingsQuery = query(
            collection(db, `venues/${doc.id}/ratings`),
          );
          const ratingsSnapshot = await getDocs(ratingsQuery);
          const ratings = ratingsSnapshot.docs.map(
            (ratingDoc) => ratingDoc.data().rating,
          );
          const avgRating =
            ratings.length > 0
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : 0;
          return { ...venue, avgRating, ratingCount: ratings.length };
        }),
      );
      setAllVenues(venuesData);
      setFilteredVenues(venuesData);
    };

    fetchVenuesAndRatings();
  }, []);

  const handleSetSelectedVenue = (venue) => {
    setSelectedVenue(venue);
    setMapCenter([venue.latitude, venue.longitude]);
    setMapZoom(16);
    // Auto switch to map view on mobile when venue is selected
    setMobileView("map");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] w-screen p-3 md:p-5 overflow-hidden">
      {/* Location Banner */}
      {showLocationBanner && (
        <LocationPermissionBanner
          onPermissionGranted={handleLocationGranted}
          onPermissionDenied={handleLocationDenied}
          onDismiss={() => setShowLocationBanner(false)}
        />
      )}

      {/* Mobile View Toggle */}
      <div className="flex gap-2 mb-3">
        <div className="md:hidden flex gap-2 flex-1">
          <Button
            variant={mobileView === "list" ? "default" : "outline"}
            onClick={() => setMobileView("list")}
            className="flex-1"
            size="sm"
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={mobileView === "map" ? "default" : "outline"}
            onClick={() => setMobileView("map")}
            className="flex-1"
            size="sm"
          >
            <Map className="h-4 w-4 mr-2" />
            Map
          </Button>
        </div>
        {!userLocation && (
          <Button
            onClick={() => setShowLocationBanner(true)}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <MapPin className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Use My Location</span>
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Hidden on mobile when map view is active */}
        <div
          className={`
          ${mobileView === "map" ? "hidden" : "flex"}
          md:flex
          w-full md:w-96
          border-r bg-background flex-col overflow-hidden
        `}
        >
          <div className="p-4 flex-shrink-0">
            <VenueFilter
              allVenues={allVenues}
              setFilteredVenues={setFilteredVenues}
            />
          </div>
          <div className="flex-1 overflow-hidden px-4 flex flex-col">
            <VenueResultList
              venues={filteredVenues}
              setSelectedVenue={handleSetSelectedVenue}
            />
          </div>
        </div>

        {/* Right Map Section - Hidden on mobile when list view is active */}
        <div
          className={`
          ${mobileView === "list" ? "hidden" : "flex"}
          md:flex
          flex-1 overflow-hidden
        `}
        >
          <PublicVenueMap
            venues={filteredVenues}
            selectedVenue={selectedVenue}
            userLocation={userLocation}
            center={mapCenter}
            zoom={mapZoom}
          />
        </div>
      </div>
    </div>
  );
};

export default VenuesPage;
