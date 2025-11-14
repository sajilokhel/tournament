"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLng } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadButton } from "@/lib/uploadthing";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { toast } from "sonner";

// Leaflet icon setup
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

const ManagerDashboard = () => {
  const [futsalGrounds, setFutsalGrounds] = useState<any[]>([]);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<LatLng | null>(null);
  const [newGroundLocation, setNewGroundLocation] = useState<LatLng | null>(
    null
  );
  const [groundName, setGroundName] = useState("");
  const [groundDescription, setGroundDescription] = useState("");
  const [groundPhoto, setGroundPhoto] = useState("");
  const [creating, setCreating] = useState<boolean>(false);

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

  const handleAddGround = async () => {
    if (!groundName.trim() || !groundPhoto) {
      toast.error("Please provide a name and an image for the venue.");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "venues"), {
        name: groundName.trim(),
        description: groundDescription.trim() || null,
        latitude: newGroundLocation?.lat || null,
        longitude: newGroundLocation?.lng || null,
        imageUrl: groundPhoto,
        createdAt: new Date().toISOString(),
      });
      setGroundName("");
      setGroundDescription("");
      setGroundPhoto("");
      setNewGroundLocation(null);
      setTempLocation(null);
      setIsFormOpen(false);
      toast.success("Venue created");
      fetchGrounds();
    } catch (err) {
      console.error("Create venue failed", err);
      toast.error("Failed to create venue");
    } finally {
      setCreating(false);
    }
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
        {!isAddingMode ? (
          <Button onClick={() => setIsAddingMode(true)}>Add Ground</Button>
        ) : (
          <Button onClick={confirmLocation} disabled={!tempLocation}>
            Confirm Location
          </Button>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent style={{ zIndex: 1000 }}>
          <DialogHeader>
            <DialogTitle>Add New Futsal Ground</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Ground Name"
              value={groundName}
              onChange={(e) => setGroundName(e.target.value)}
            />
            <Textarea
              placeholder="Ground Description"
              value={groundDescription}
              onChange={(e) => setGroundDescription(e.target.value)}
            />
            <UploadButton
              endpoint="imageUploader"
              appearance={{
                button:
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full",
                container: "w-full",
                allowedContent: "hidden",
              }}
              content={{
                button: "Choose Image",
              }}
              onClientUploadComplete={(res) => {
                if (res) {
                  setGroundPhoto(res[0].url);
                  toast.success("Image uploaded successfully");
                }
              }}
              onUploadError={(error: Error) => {
                toast.error(`ERROR! ${error.message}`);
              }}
            />
            <Button
              onClick={handleAddGround}
              disabled={creating || !groundPhoto}
            >
              {creating ? "Adding..." : "Add Ground"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Popup>You are here</Popup>
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
            >
              <Popup>
                <h3>{ground.name}</h3>
                <p>{ground.description}</p>
                {ground.imageUrl && (
                  <img
                    src={ground.imageUrl}
                    alt={ground.name}
                    style={{ width: "100px" }}
                  />
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default ManagerDashboard;
