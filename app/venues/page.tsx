"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Star, Map, List, MapPin, Filter } from "lucide-react";
import dynamic from "next/dynamic";
import { LocationPermissionBanner } from "@/components/LocationPermissionBanner";

const PublicVenueMap = dynamic(() => import("@/components/PublicVenueMap"), {
  ssr: false,
});

interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour?: number;
  averageRating?: number;
  reviewCount?: number;
  [key: string]: any;
}

const VenueFilter = ({ setFilteredVenues, allVenues }: { setFilteredVenues: (venues: Venue[]) => void; allVenues: Venue[] }) => {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");
  
  const [searchTerm, setSearchTerm] = useState(urlSearch || "");
  const [showFilters, setShowFilters] = useState(false);
  
  // Temporary filter values (before applying)
  const [tempMinRating, setTempMinRating] = useState(0);
  const [tempMinPrice, setTempMinPrice] = useState("");
  const [tempMaxPrice, setTempMaxPrice] = useState("");
  
  // Applied filter values (after clicking Apply)
  const [minRating, setMinRating] = useState(0);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const applyFilters = () => {
    setMinRating(tempMinRating);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setTempMinRating(0);
    setTempMinPrice("");
    setTempMaxPrice("");
    setMinRating(0);
    setMinPrice("");
    setMaxPrice("");
  };

  // Update search term when URL param changes
  useEffect(() => {
    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [urlSearch]);

  useEffect(() => {
    let filtered = allVenues;

    if (searchTerm) {
      filtered = filtered.filter((venue) =>
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (minRating > 0) {
      filtered = filtered.filter((venue) => (venue.averageRating || 0) >= minRating);
    }

    if (minPrice !== "") {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        filtered = filtered.filter((venue) => (venue.pricePerHour || 0) >= min);
      }
    }

    if (maxPrice !== "") {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        filtered = filtered.filter((venue) => (venue.pricePerHour || 0) <= max);
      }
    }

    setFilteredVenues(filtered);
  }, [searchTerm, minRating, minPrice, maxPrice, allVenues, setFilteredVenues]);

  return (
    <div className="space-y-3">
      {/* Search Bar - Always Visible */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          title="Toggle filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Active Filters Indicator */}
      {(minRating > 0 || minPrice !== "" || maxPrice !== "") && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Active filters:</span>
          {minRating > 0 && (
            <span className="bg-primary/10 text-primary px-2 py-1 rounded">
              {minRating}+ stars
            </span>
          )}
          {minPrice !== "" && (
            <span className="bg-primary/10 text-primary px-2 py-1 rounded">
              Min: Rs. {minPrice}
            </span>
          )}
          {maxPrice !== "" && (
            <span className="bg-primary/10 text-primary px-2 py-1 rounded">
              Max: Rs. {maxPrice}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
          <h3 className="text-sm font-semibold">Advanced Filters</h3>
          
          {/* Rating Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Rating:
            </label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`cursor-pointer h-5 w-5 ${
                    tempMinRating >= star
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-300"
                  }`}
                  onClick={() => setTempMinRating(star)}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTempMinRating(0)}
                className="ml-2"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Price Range (Rs./hour):
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={tempMinPrice}
                onChange={(e) => setTempMinPrice(e.target.value)}
                className="flex-1"
                min="0"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={tempMaxPrice}
                onChange={(e) => setTempMaxPrice(e.target.value)}
                className="flex-1"
                min="0"
              />
            </div>
          </div>

          {/* Apply and Cancel Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={applyFilters}
              className="flex-1"
              size="sm"
            >
              Apply Filters
            </Button>
            <Button
              onClick={() => setShowFilters(false)}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const VenueResultList = ({ venues, setSelectedVenue }: { venues: Venue[]; setSelectedVenue: (venue: Venue) => void }) => {
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
                  {venue.averageRating && venue.averageRating > 0 ? (
                    <>
                      <div className="flex items-center">
                        {[...Array(Math.floor(venue.averageRating))].map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 text-yellow-400 fill-yellow-400"
                          />
                        ))}
                        {[...Array(5 - Math.floor(venue.averageRating))].map(
                          (_, i) => (
                            <Star key={i} className="h-4 w-4 text-gray-300" />
                          ),
                        )}
                      </div>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {venue.averageRating.toFixed(1)} ({venue.reviewCount}{" "}
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
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
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
    // Only center on user location if no venue is selected
    if (!selectedVenue) {
      setMapCenter(location);
      setMapZoom(14);
    }
  };

  const handleLocationDenied = () => {
    // Keep default location (Kathmandu)
    console.log("User denied location access, using default location");
  };

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) return;

    // Check permission status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              handleLocationGranted([
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
        // If denied, we don't show banner automatically to avoid annoyance
      });
    } else {
      // Fallback: just try to get position, if it fails/prompts, the browser handles it
      // But we want to show our nice banner if possible.
      // Since we can't know if it's prompt or denied without trying, 
      // and trying triggers the browser prompt, let's show our banner.
      setShowLocationBanner(true);
    }
  }, []);

  useEffect(() => {
    const fetchVenuesAndRatings = async () => {
      const venuesCollection = await getDocs(collection(db, "venues"));
      const venuesData = venuesCollection.docs.map((doc) => {
        return { id: doc.id, ...doc.data() } as Venue;
      });
      setAllVenues(venuesData);
      setFilteredVenues(venuesData);
    };

    fetchVenuesAndRatings();
  }, []);

  const handleSetSelectedVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    setMapCenter([venue.latitude, venue.longitude]);
    setMapZoom(16);
    // Auto switch to map view on mobile when venue is selected
    setMobileView("map");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden pt-20 pb-4">
      {/* Location Banner */}
      {showLocationBanner && (
        <LocationPermissionBanner
          onPermissionGranted={handleLocationGranted}
          onPermissionDenied={handleLocationDenied}
          onDismiss={() => setShowLocationBanner(false)}
        />
      )}

      {/* Mobile View Toggle */}
      <div className="flex gap-2 px-3 py-2 md:px-5 md:py-2 border-b bg-background">
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
