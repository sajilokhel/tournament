"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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
      key={mapCenter.join(",")}
    >
      <ChangeView center={mapCenter} zoom={mapZoom} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* User Location Marker with Ripple Effect */}
      {userLocation && (
        <Marker position={userLocation} icon={createUserLocationIcon()}>
          <Popup>
            <div className="text-center font-semibold">📍 Your Location</div>
          </Popup>
        </Marker>
      )}

      {/* Venue Markers with Enhanced Info Boxes */}
      {venues.map((ground) => (
        <Marker
          key={ground.id}
          position={[ground.latitude, ground.longitude]}
          icon={createVenueIcon(selectedVenue?.id === ground.id)}
          eventHandlers={{
            click: () => handleMarkerClick(ground.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: "200px" }}>
              <div className="font-bold text-base mb-1">{ground.name}</div>
              <div className="text-sm text-gray-600 mb-2">
                📍 {ground.address}
              </div>
              {ground.avgRating > 0 && (
                <div className="text-sm mb-2">
                  ⭐ {ground.avgRating.toFixed(1)} / 5
                  <span className="text-xs text-gray-500 ml-1">
                    ({ground.ratingCount} reviews)
                  </span>
                </div>
              )}
              {ground.facilities && (
                <div className="text-xs text-gray-500 mb-2">
                  {ground.facilities}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(ground.id);
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-3 rounded mt-2 transition-colors"
              >
                View Details
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default PublicVenueMap;
