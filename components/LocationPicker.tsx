"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default Leaflet icon path issues with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
}

// Component to handle map clicks and marker dragging
const DraggableMarker = ({
  position,
  setPosition,
}: {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
    },
  });

  return (
    <Marker
      draggable={true}
      position={position}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const newPos = marker.getLatLng();
            setPosition([newPos.lat, newPos.lng]);
          }
        },
      }}
    />
  );
};

const LocationPicker = ({
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerProps) => {
  const [currentLat, setCurrentLat] = useState(latitude || 27.7172);
  const [currentLng, setCurrentLng] = useState(longitude || 85.3240);
  const [searchQuery, setSearchQuery] = useState("");
  const mapRef = useRef<L.Map | null>(null);

  const setPosition = (pos: [number, number]) => {
    setCurrentLat(pos[0]);
    setCurrentLng(pos[1]);
    onLocationChange(pos[0], pos[1]);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        setCurrentLat(newLat);
        setCurrentLng(newLng);
        onLocationChange(newLat, newLng);

        // Fly to new location on map
        if (mapRef.current) {
          mapRef.current.flyTo([newLat, newLng], 15);
        }

        toast.success("Location updated to your current position");
      },
      (error) => {
        toast.error("Unable to retrieve your location");
      }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        
        setCurrentLat(lat);
        setCurrentLng(lon);
        onLocationChange(lat, lon);

        // Fly to new location on map
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lon], 15);
        }

        toast.success("Location found");
      } else {
        toast.error("Location not found. Please try a different search term.");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      toast.error("Failed to search location");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Set Venue Location
        </CardTitle>
        <CardDescription>
          Click on the map or drag the marker to set the exact location of your venue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <Input
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline">
            Search
          </Button>
          <Button onClick={handleGetCurrentLocation} variant="outline" size="icon">
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        {/* Map */}
        <div className="w-full h-[400px] rounded-lg overflow-hidden border-2 border-gray-200">
          <MapContainer
            center={[currentLat, currentLng]}
            zoom={15}
            style={{ width: "100%", height: "100%" }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <DraggableMarker
              position={[currentLat, currentLng]}
              setPosition={setPosition}
            />
          </MapContainer>
        </div>

        {/* Coordinates Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            Selected Coordinates:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-blue-700">Latitude</label>
              <p className="font-mono text-sm text-gray-900">
                {currentLat.toFixed(6)}
              </p>
            </div>
            <div>
              <label className="text-xs text-blue-700">Longitude</label>
              <p className="font-mono text-sm text-gray-900">
                {currentLng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          💡 Tip: You can drag the marker or click anywhere on the map to set the location
        </p>
      </CardContent>
    </Card>
  );
};

export default LocationPicker;
