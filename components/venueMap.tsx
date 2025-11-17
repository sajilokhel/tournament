"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLng } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import AddGround from "./addGround";
import { useRouter } from "next/navigation";

// Fix for default Leaflet icon path issues with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const AddGroundMarker = ({
  onLocationSelect,
}: {
  onLocationSelect: (location: LatLng) => void;
}) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
};

const VenueMap = () => {
  const { user, role } = useAuth();
  const router = useRouter();

  // State for all venues to display on the map
  const [allVenues, setAllVenues] = useState<any[]>([]);
  // State for venues managed by the current user
  const [managedVenues, setManagedVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<LatLng | null>(null);
  const [newGroundLocation, setNewGroundLocation] = useState<LatLng | null>(
    null
  );

  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedLocation, setSearchedLocation] = useState<
    [number, number] | null
  >(null);
  const mapRef = useRef<L.Map | null>(null);

  // Fetches ALL venues for the map markers
  const fetchAllVenues = async () => {
    try {
      const q = query(
        collection(db, "venues"),
        orderBy("createdAt", "desc"),
        limit(500)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setAllVenues(list);
    } catch (error) {
      console.error("Error fetching all venues:", error);
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
        where("managedBy", "==", user.uid)
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

  // A combined function to refresh both lists, passed to the AddGround form
  const refreshAllData = () => {
    fetchAllVenues();
    fetchManagedVenues();
  };

  useEffect(() => {
    // Fetch all venues for the map
    fetchAllVenues();
    // Fetch venues specific to the manager for the list view
    fetchManagedVenues();

    // Get user's current location to display on the map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        // Don't flyTo here automatically to respect user's map interaction
      });
    }
  }, [user, role]); // Rerun effects when user or role changes

  const handleSearch = async () => {
    if (searchQuery.trim() === "") return;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setSearchedLocation([lat, lon]);
      mapRef.current?.flyTo([lat, lon], 15);
    }
  };

  const handleLocationSelect = (location: LatLng) => setTempLocation(location);

  const confirmLocation = () => {
    if (tempLocation) {
      setNewGroundLocation(tempLocation);
      setIsAddingMode(false);
      setIsFormOpen(true);
    }
  };

  const handleMarkerClick = (groundId: string) =>
    router.push(`/venue/${groundId}`);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a location"
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>
        {role === "manager" && (
          <>
            {!isAddingMode ? (
              <Button onClick={() => setIsAddingMode(true)}>Add Ground</Button>
            ) : (
              <Button onClick={confirmLocation} disabled={!tempLocation}>
                Confirm Location
              </Button>
            )}
          </>
        )}
      </div>

      <AddGround
        newGroundLocation={newGroundLocation}
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        fetchGrounds={refreshAllData}
      />

      <div className="rounded-lg overflow-hidden border mb-8">
        <MapContainer
          center={[27.7172, 85.324]}
          zoom={12}
          style={{ height: "400px", width: "100%" }}
          whenReady={(e) => {
            mapRef.current = e.target;
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Marker for the user's current location */}
          {userLocation && (
            <Marker position={userLocation}>
              <Tooltip>You are here</Tooltip>
            </Marker>
          )}

          {/* Marker for a searched location */}
          {searchedLocation && (
            <Marker position={searchedLocation}>
              <Tooltip>Search Result</Tooltip>
            </Marker>
          )}

          {/* Markers for adding a new ground */}
          {isAddingMode && (
            <AddGroundMarker onLocationSelect={handleLocationSelect} />
          )}
          {tempLocation && (
            <Marker position={tempLocation}>
              <Tooltip>New futsal ground location</Tooltip>
            </Marker>
          )}

          {/* Markers for ALL futsal grounds */}
          {allVenues.map((ground) => (
            <Marker
              key={ground.id}
              position={[ground.latitude, ground.longitude]}
              eventHandlers={{ click: () => handleMarkerClick(ground.id) }}
            >
              <Tooltip>
                <h3>{ground.name}</h3>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* This section only renders for managers */}
      {role === "manager" && (
        <div>
          <h2 className="text-2xl font-bold mb-4">My Grounds</h2>
          {loading && <p>Loading venues...</p>}
          {!loading && managedVenues.length === 0 && (
            <p>You have not added any grounds yet.</p>
          )}
          {!loading && managedVenues.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {managedVenues.map((venue) => (
                <Card key={venue.id} className="min-h-[160px]">
                  <CardHeader>
                    <CardTitle>{venue.name}</CardTitle>
                    <CardDescription>{venue.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {venue.facilities}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/venue/${venue.id}`}>
                      <Button>View Details</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VenueMap;
