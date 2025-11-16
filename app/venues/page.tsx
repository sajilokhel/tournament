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
import { Star } from "lucide-react";
import dynamic from "next/dynamic";

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
        venue.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Filter Venues</h3>
      <Input
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700">
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
        <label className="block text-sm font-medium text-gray-700">
          Amenities:
        </label>
        <div className="flex flex-col space-y-2 mt-1">
          <label className="flex items-center gap-2 font-normal">
            <input
              type="checkbox"
              checked={amenities.parking}
              onChange={(e) =>
                setAmenities({ ...amenities, parking: e.target.checked })
              }
            />
            Parking
          </label>
          <label className="flex items-center gap-2 font-normal">
            <input
              type="checkbox"
              checked={amenities.covered}
              onChange={(e) =>
                setAmenities({ ...amenities, covered: e.target.checked })
              }
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
    <div className="space-y-4 mt-4 h-[600px] overflow-y-auto pr-2">
      <h3 className="text-lg font-semibold">
        Available Venues ({venues.length})
      </h3>
      {venues.length === 0 ? (
        <p>No venues match the current filters.</p>
      ) : (
        venues.map((venue) => (
          <Card
            key={venue.id}
            className="shadow-sm hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <CardTitle>{venue.name}</CardTitle>
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
                        )
                      )}
                    </div>
                    <span className="ml-2 text-sm text-gray-600">
                      {venue.avgRating.toFixed(1)} ({venue.ratingCount} reviews)
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">No ratings yet</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{venue.address}</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
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
        ))
      )}
    </div>
  );
};

const VenuesPage = () => {
  const [allVenues, setAllVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    27.7172, 85.324,
  ]);
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
      });
    }

    const fetchVenuesAndRatings = async () => {
      const venuesCollection = await getDocs(collection(db, "venues"));
      const venuesData = await Promise.all(
        venuesCollection.docs.map(async (doc) => {
          const venue = { id: doc.id, ...doc.data() };
          const ratingsQuery = query(
            collection(db, `venues/${doc.id}/ratings`)
          );
          const ratingsSnapshot = await getDocs(ratingsQuery);
          const ratings = ratingsSnapshot.docs.map(
            (ratingDoc) => ratingDoc.data().rating
          );
          const avgRating =
            ratings.length > 0
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : 0;
          return { ...venue, avgRating, ratingCount: ratings.length };
        })
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
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Explore Futsal Venues</h1>
      {/* This change prevents the map column from stretching */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-start">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <VenueFilter
            allVenues={allVenues}
            setFilteredVenues={setFilteredVenues}
          />
          <VenueResultList
            venues={filteredVenues}
            setSelectedVenue={handleSetSelectedVenue}
          />
        </div>
        <div className="lg:col-span-2 h-[80vh] sticky top-20">
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
