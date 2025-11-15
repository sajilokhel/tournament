"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLng } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import AddGround from "./addGround";
import { useRouter } from "next/navigation";

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
  const { role } = useAuth();
  const router = useRouter();
  const [futsalGrounds, setFutsalGrounds] = useState<any[]>([]);
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

  const fetchGrounds = async () => {
    const q = query(
      collection(db, "venues"),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setFutsalGrounds(list);
  };

  useEffect(() => {
    fetchGrounds();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        mapRef.current?.flyTo([latitude, longitude], 13);
      });
    }
  }, []);

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

  const handleLocationSelect = (location: LatLng) => {
    setTempLocation(location);
  };

  const confirmLocation = () => {
    if (tempLocation) {
      setNewGroundLocation(tempLocation);
      setIsAddingMode(false);
      setIsFormOpen(true);
    }
  };

  const handleMarkerClick = (groundId: string) => {
    router.push(`/venue/${groundId}`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
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
        fetchGrounds={fetchGrounds}
      />

      <div className="rounded-lg overflow-hidden border">
        <MapContainer
          center={[27.7172, 85.324]}
          zoom={13}
          style={{ height: "400px", width: "100%" }}
          whenReady={(e) => {
            mapRef.current = e.target;
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {isAddingMode && (
            <AddGroundMarker onLocationSelect={handleLocationSelect} />
          )}
          {userLocation && (
            <Marker position={userLocation}>
              <Tooltip>You are here</Tooltip>
            </Marker>
          )}
          {searchedLocation && (
            <Marker position={searchedLocation}>
              <Popup>Search Result</Popup>
            </Marker>
          )}
          {tempLocation && (
            <Marker position={tempLocation}>
              <Popup>New futsal ground location</Popup>
            </Marker>
          )}
          {futsalGrounds.map((ground) => (
            <Marker
              key={ground.id}
              position={[ground.latitude, ground.longitude]}
              eventHandlers={{
                click: () => handleMarkerClick(ground.id),
              }}
            >
              <Tooltip>
                <h3>{ground.name}</h3>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default VenueMap;
