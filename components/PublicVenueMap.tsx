"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Fix for leaflet's default icon path in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const ChangeView = ({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface PublicVenueMapProps {
  venues: any[];
  selectedVenue?: any | null;
  userLocation?: [number, number] | null;
  center: [number, number];
  zoom: number;
}

const PublicVenueMap = ({
  venues,
  selectedVenue,
  userLocation,
  center,
  zoom,
}: PublicVenueMapProps) => {
  const router = useRouter();

  const handleMarkerClick = (groundId: string) => {
    router.push(`/venue/${groundId}`);
  };

  const mapCenter: [number, number] = selectedVenue
    ? [selectedVenue.latitude, selectedVenue.longitude]
    : center;

  const mapZoom = selectedVenue ? 15 : zoom;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: "100%", width: "100%", borderRadius: "8px" }}
      // key is important to re-render map on center change
      key={mapCenter.join(",")}
    >
      <ChangeView center={mapCenter} zoom={mapZoom} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {userLocation && (
        <Marker position={userLocation}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {venues.map((ground) => (
        <Marker
          key={ground.id}
          position={[ground.latitude, ground.longitude]}
          eventHandlers={{
            click: () => handleMarkerClick(ground.id),
          }}
        >
          <Tooltip>
            <h3>{ground.name}</h3>
            <p>
              Rating:{" "}
              {ground.avgRating > 0
                ? `${ground.avgRating.toFixed(1)} / 5`
                : "Not rated"}
            </p>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default PublicVenueMap;
