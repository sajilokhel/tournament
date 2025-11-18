"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

interface VenueLocationMapProps {
  latitude: number;
  longitude: number;
  venueName: string;
  address?: string;
}

const VenueLocationMap = ({
  latitude,
  longitude,
  venueName,
  address,
}: VenueLocationMapProps) => {
  if (!latitude || !longitude) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Location not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px] rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Marker position={[latitude, longitude]}>
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold mb-1">{venueName}</h3>
                  {address && <p className="text-sm text-gray-600">{address}</p>}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
        <div className="mt-4 flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {address && <p>{address}</p>}
            <p className="text-xs text-gray-500 mt-1">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VenueLocationMap;
