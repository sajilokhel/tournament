"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Tooltip,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLng, DivIcon } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

import { useRouter } from "next/navigation";
import { Search, MapPin, Navigation, Loader2, Map, List } from "lucide-react";

import { LocationPermissionBanner } from "./LocationPermissionBanner";
// Fix for default Leaflet icon path issues with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Map controller to handle flyTo
const MapController = ({ 
  mapRef, 
  userLocation 
}: { 
  mapRef: React.MutableRefObject<L.Map | null>;
  userLocation: [number, number] | null;
}) => {
  const map = useMap();
  
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (userLocation && map) {
      map.flyTo(userLocation, 14, { duration: 1.5 });
    }
  }, [userLocation, map]);

  return null;
};
// Fix for default Leaflet icon path issues with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Custom user location marker with ripple effect
const createUserLocationIcon = () => {
  return L.divIcon({
    className: "custom-user-location-marker",
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 2;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: ripple 2s infinite;
          z-index: 1;
        "></div>
        <style>
          @keyframes ripple {
            0% {
              transform: translate(-50%, -50%) scale(0.5);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0;
            }
          }
        </style>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Custom venue marker
const createVenueIcon = (isSelected: boolean) => {
  return L.divIcon({
    className: "custom-venue-marker",
    html: `
      <div style="
        width: 32px;
        height: 40px;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.2 0 0 7.2 0 16c0 8.8 16 24 16 24s16-15.2 16-24C32 7.2 24.8 0 16 0z"
                fill="${isSelected ? "#ef4444" : "#10b981"}"
                stroke="white"
                stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};



// Helper function to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const VenueMap = () => {
  const { user, role } = useAuth();
  const router = useRouter();

  const [allVenues, setAllVenues] = useState<any[]>([]);
  const [managedVenues, setManagedVenues] = useState<any[]>([]);
  const [displayedVenues, setDisplayedVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);



  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [searchedLocation, setSearchedLocation] = useState<
    [number, number] | null
  >(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [showLocationBanner, setShowLocationBanner] = useState(false);

  const handleLocationGranted = (location: [number, number]) => {
    // Validate location coordinates
    if (!location || location.length !== 2 || isNaN(location[0]) || isNaN(location[1])) {
      console.error("Invalid location coordinates:", location);
      return;
    }
    
    setUserLocation(location);
    if (mapRef.current) {
      mapRef.current.flyTo(location, 14, { duration: 1.5 });
    }
  };

  const handleLocationDenied = () => {
    console.log("User denied location access");
  };

  // Fetches ALL venues for the map markers
  const fetchAllVenues = async () => {
    try {
      const q = query(
        collection(db, "venues"),
        orderBy("createdAt", "desc"),
        limit(500),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setAllVenues(list);
      return list;
    } catch (error) {
      console.error("Error fetching all venues:", error);
      return [];
    }
  };

  // Fetches only the venues managed by the logged-in manager
  const fetchManagedVenues = async () => {
    if (!user || role !== "manager") {
      setManagedVenues([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid),
      );
      const querySnapshot = await getDocs(q);
      const venueList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];
      setManagedVenues(venueList);
    } catch (error) {
      console.error("Error fetching managed venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllData = async () => {
    const venues = await fetchAllVenues();
    await fetchManagedVenues();
    updateDisplayedVenues(venues, searchQuery, userLocation);
  };

  const updateDisplayedVenues = (
    venues: any[],
    query: string,
    userLoc: [number, number] | null,
  ) => {
    if (query.trim() === "" && userLoc) {
      // Show top 5 nearest venues when search is empty
      const venuesWithDistance = venues.map((venue) => ({
        ...venue,
        distance: calculateDistance(
          userLoc[0],
          userLoc[1],
          venue.latitude,
          venue.longitude,
        ),
      }));
      const sorted = venuesWithDistance.sort((a, b) => a.distance - b.distance);
      setDisplayedVenues(sorted.slice(0, 5));
    } else if (query.trim() !== "") {
      // Filter venues based on search query
      const filtered = venues.filter(
        (venue) =>
          venue.name?.toLowerCase().includes(query.toLowerCase()) ||
          venue.address?.toLowerCase().includes(query.toLowerCase()) ||
          venue.facilities?.toLowerCase().includes(query.toLowerCase()),
      );
      setDisplayedVenues(filtered);
    } else {
      // Show all venues if no user location and no search
      setDisplayedVenues(venues.slice(0, 5));
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      const venues = await fetchAllVenues();
      await fetchManagedVenues();

      // Location will be handled by LocationPermissionBanner
      updateDisplayedVenues(venues, "", null);
    };

    initializeData();
  }, [user, role]);

  useEffect(() => {
    updateDisplayedVenues(allVenues, searchQuery, userLocation);
  }, [searchQuery, allVenues, userLocation]);

  const handleSearch = async () => {
    if (searchQuery.trim() === "") {
      setSearchedLocation(null);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setSearchedLocation([lat, lon]);
        mapRef.current?.flyTo([lat, lon], 15);
      }
    } catch (error) {
      console.error("Error searching location:", error);
    }
  };



  const handleMarkerClick = (groundId: string) => {
    setSelectedVenue(groundId);
  };

  const handleVenueCardClick = (venue: any) => {
    setSelectedVenue(venue.id);
    mapRef.current?.flyTo([venue.latitude, venue.longitude], 16);
  };

  const handleViewDetails = (venueId: string, type?: string) => {
    if (type === "manager"){
      router.push(`/manager/venue-settings?id=${venueId}`);
    }else{
      router.push(`/venue/${venueId}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] w-screen overflow-hidden py-10 px-5">


      {/* Location Permission Banner */}
      {showLocationBanner && (
        <LocationPermissionBanner
          onPermissionGranted={handleLocationGranted}
          onPermissionDenied={handleLocationDenied}
          onDismiss={() => setShowLocationBanner(false)}
        />
      )}

      {/* Mobile View Toggle */}
      <div className="md:hidden flex gap-2 mb-3">
        <Button
          variant={mobileView === "list" ? "default" : "outline"}
          onClick={() => setMobileView("list")}
          className="flex-1"
          size="sm"
        >
          <List className="h-4 w-4 mr-2" />
          Venues
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

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`
          ${mobileView === "map" ? "hidden" : "flex"}
          md:flex
          w-full md:w-96 lg:w-[400px]
          flex-col border-r bg-background overflow-hidden
        `}>
          {/* Search Section */}
          <div className="p-4 border-b space-y-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search venues or locations..."
                  className="pl-9"
                />
              </div>
              {!userLocation && (
                <Button 
                  onClick={() => setShowLocationBanner(true)} 
                  size="icon" 
                  variant="outline"
                  title="Use my location"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleSearch} size="icon" variant="secondary">
                <Navigation className="h-4 w-4" />
              </Button>
            </div>


          </div>

          {/* Results Section */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {searchQuery.trim() === "" ? "Nearby Venues" : "Search Results"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {displayedVenues.length}{" "}
                {displayedVenues.length === 1 ? "venue" : "venues"}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayedVenues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No venues found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try a different search term</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedVenues.map((venue) => (
                  <Card
                    key={venue.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedVenue === venue.id
                        ? "ring-2 ring-primary border-primary"
                        : ""
                    }`}
                    onClick={() => handleVenueCardClick(venue)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base leading-tight">
                            {venue.name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {venue.description}
                          </CardDescription>
                        </div>
                        {venue.distance && (
                          <div className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded">
                            {venue.distance.toFixed(1)} km
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      {venue.facilities && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {venue.facilities}
                        </p>
                      )}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(venue.id);
                        }}
                        size="sm"
                        className="mt-3 w-full"
                        variant="outline"
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Manager's Grounds Section */}
            {role === "manager" && managedVenues.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="text-lg font-semibold mb-3">
                  My Managed Grounds
                </h2>
                <div className="space-y-3">
                  {managedVenues.map((venue) => (
                    <Card
                      key={venue.id}
                      className="cursor-pointer hover:shadow-md transition-all"
                      onClick={() => handleVenueCardClick(venue)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {venue.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          {venue.address}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        {venue.facilities && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {venue.facilities}
                          </p>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(venue.id, "manager");
                          }}
                          size="sm"
                          className="w-full"
                        >
                          Manage Ground
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Map Section */}
        <div className={`
          ${mobileView === "list" ? "hidden" : "flex"}
          md:flex
          flex-1 relative overflow-hidden
        `}>
          <div className="absolute inset-0 rounded-lg overflow-hidden border">
            <MapContainer
              center={[27.7172, 85.324]}
              zoom={12}
              style={{ width: "100%", height: "100%" }}
            >
              <MapController mapRef={mapRef} userLocation={userLocation} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {userLocation && (
                <Marker position={userLocation} icon={createUserLocationIcon()}>
                  <Popup>
                    <div className="text-center font-semibold">
                      📍 Your Location
                    </div>
                  </Popup>
                </Marker>
              )}

              {searchedLocation && (
                <Marker position={searchedLocation}>
                  <Tooltip>Search Result</Tooltip>
                </Marker>
              )}



              {allVenues.map((ground) => (
                <Marker
                  key={ground.id}
                  position={[ground.latitude, ground.longitude]}
                  icon={createVenueIcon(selectedVenue === ground.id)}
                  eventHandlers={{ click: () => handleMarkerClick(ground.id) }}
                >
                  <Popup>
                    <div style={{ minWidth: "200px" }}>
                      <div className="font-bold text-base mb-1">
                        {ground.name}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        📍 {ground.address}
                      </div>
                      {ground.facilities && (
                        <div className="text-xs text-gray-500 mb-2">
                          {ground.facilities}
                        </div>
                      )}
                      <button
                        onClick={() => handleViewDetails(ground.id)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-3 rounded mt-2 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueMap;
