"use client";

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const HomePageMap = () => {
  const router = useRouter();
  const [futsalGrounds, setFutsalGrounds] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
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

    fetchGrounds();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        mapRef.current?.flyTo([latitude, longitude], 13);
      });
    }
  }, []);

  const handleMarkerClick = (groundId: string) => {
    router.push(`/venue/${groundId}`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
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
          {userLocation && (
            <Marker position={userLocation}>
              <Tooltip>You are here</Tooltip>
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

export default HomePageMap;
