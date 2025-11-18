"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadButton } from "@/lib/uploadthing";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { initializeVenueSlots } from "@/lib/slotService";
import LocationPicker from "@/components/LocationPicker";
import { Loader2 } from "lucide-react";

interface Attribute {
  key: string;
  value: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const AddGround = ({
  isFormOpen,
  setIsFormOpen,
  fetchGrounds,
}: {
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  fetchGrounds: () => void;
}) => {
  const { user } = useAuth();
  
  // Basic Info
  const [groundName, setGroundName] = useState("");
  const [groundDescription, setGroundDescription] = useState("");
  const [groundPhotos, setGroundPhotos] = useState<string[]>([]);
  const [pricePerHour, setPricePerHour] = useState("");
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  
  // Location
  const [latitude, setLatitude] = useState(27.7172);
  const [longitude, setLongitude] = useState(85.3240);
  const [address, setAddress] = useState("");
  
  // Slot Configuration
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("22:00");
  const [slotDuration, setSlotDuration] = useState(60);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  
  const [creating, setCreating] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentTab, setCurrentTab] = useState("basic");

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: "", value: "" }]);
  };

  const handleAttributeChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const calculateSlotCount = (): number => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    return Math.floor(totalMinutes / slotDuration);
  };

  const validateSlotConfig = (): string | null => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      return "End time must be after start time";
    }

    if (slotDuration < 15 || slotDuration > 240) {
      return "Slot duration must be between 15 and 240 minutes";
    }

    const totalMinutes = endMinutes - startMinutes;
    if (totalMinutes < slotDuration) {
      return "Time range is too short for the slot duration";
    }

    if (daysOfWeek.length === 0) {
      return "At least one day must be selected";
    }

    return null;
  };

  const handleAddGround = async () => {
    // Basic validation
    if (
      !groundName.trim() ||
      groundPhotos.length === 0 ||
      !user ||
      !pricePerHour.trim()
    ) {
      toast.error(
        "Please provide a name, at least one image, and a price for the venue."
      );
      return;
    }

    // Slot config validation
    const slotError = validateSlotConfig();
    if (slotError) {
      toast.error(slotError);
      setCurrentTab("slots");
      return;
    }

    setCreating(true);
    try {
      // Create venue document
      const newVenueRef = await addDoc(collection(db, "venues"), {
        name: groundName.trim(),
        description: groundDescription.trim() || null,
        latitude: latitude,
        longitude: longitude,
        address: address.trim() || null,
        imageUrls: groundPhotos,
        pricePerHour: parseFloat(pricePerHour),
        attributes: attributes.reduce((acc, attr) => {
          if (attr.key.trim() && attr.value.trim()) {
            acc[attr.key.trim()] = attr.value.trim();
          }
          return acc;
        }, {} as { [key: string]: string }),
        createdAt: new Date().toISOString(),
        managedBy: user.uid,
      });

      // Initialize slot configuration
      await initializeVenueSlots(newVenueRef.id, {
        startTime,
        endTime,
        slotDuration,
        daysOfWeek,
        timezone: "Asia/Kathmandu",
      });

      // Reset form
      setGroundName("");
      setGroundDescription("");
      setGroundPhotos([]);
      setPricePerHour("");
      setAttributes([]);
      setLatitude(27.7172);
      setLongitude(85.3240);
      setAddress("");
      setStartTime("06:00");
      setEndTime("22:00");
      setSlotDuration(60);
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      setCurrentTab("basic");
      
      setIsFormOpen(false);
      toast.success("Venue created successfully with slot configuration!");
      fetchGrounds();
    } catch (err) {
      console.error("Create venue failed", err);
      toast.error("Failed to create venue");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Venue</DialogTitle>
          <DialogDescription>
            Add a new venue with location and slot configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="slots">Slot Config</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div>
              <Label htmlFor="name">Venue Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Champion Futsal Arena"
                value={groundName}
                onChange={(e) => setGroundName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your venue..."
                value={groundDescription}
                onChange={(e) => setGroundDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="price">Price per Hour (NPR) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="e.g., 1500"
                value={pricePerHour}
                onChange={(e) => setPricePerHour(e.target.value)}
              />
            </div>

            <div>
              <Label>Attributes (Optional)</Label>
              {attributes.map((attr, index) => (
                <div key={index} className="flex space-x-2 mt-2">
                  <Input
                    placeholder="Attribute (e.g., Parking)"
                    value={attr.key}
                    onChange={(e) =>
                      handleAttributeChange(index, "key", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Value (e.g., Available)"
                    value={attr.value}
                    onChange={(e) =>
                      handleAttributeChange(index, "value", e.target.value)
                    }
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={handleAddAttribute}
                className="mt-2"
              >
                + Add Attribute
              </Button>
            </div>

            <Button onClick={() => setCurrentTab("location")} className="w-full">
              Next: Set Location →
            </Button>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-4">
            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                placeholder="e.g., Kumaripati, Lalitpur"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <Label>Map Location</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Click on the map or search to set your venue location
              </p>
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                onLocationChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentTab("basic")}
                className="flex-1"
              >
                ← Back
              </Button>
              <Button onClick={() => setCurrentTab("slots")} className="flex-1">
                Next: Slot Config →
              </Button>
            </div>
          </TabsContent>

          {/* Slot Configuration Tab */}
          <TabsContent value="slots" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Opening Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endTime">Closing Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="slotDuration">Slot Duration (minutes) *</Label>
              <Input
                id="slotDuration"
                type="number"
                min="15"
                max="240"
                step="15"
                value={slotDuration}
                onChange={(e) => setSlotDuration(parseInt(e.target.value) || 60)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {calculateSlotCount()} slots per day ({startTime} - {endTime})
              </p>
            </div>

            <div>
              <Label>Operating Days *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={daysOfWeek.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                    />
                    <Label
                      htmlFor={`day-${day.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Configuration Summary:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Operating Hours: {startTime} - {endTime}</li>
                <li>• Slot Duration: {slotDuration} minutes</li>
                <li>• Slots per day: {calculateSlotCount()}</li>
                <li>• Operating Days: {daysOfWeek.length} day(s)/week</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentTab("location")}
                className="flex-1"
              >
                ← Back
              </Button>
              <Button onClick={() => setCurrentTab("images")} className="flex-1">
                Next: Upload Images →
              </Button>
            </div>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-4">
            <div>
              <Label>Venue Images *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Upload at least one image of your venue
              </p>
              <UploadButton
                endpoint="imageUploader"
                appearance={{
                  button:
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full",
                  container: "w-full",
                  allowedContent: "hidden",
                }}
                content={{
                  button: groundPhotos.length > 0 
                    ? `${groundPhotos.length} image(s) uploaded - Upload more`
                    : "Choose Images (up to 5)",
                }}
                onUploadProgress={(progress) => {
                  setUploadProgress(progress);
                }}
                onClientUploadComplete={(res) => {
                  if (res) {
                    const urls = res.map((r) => r.url);
                    setGroundPhotos([...groundPhotos, ...urls]);
                    toast.success("Images uploaded successfully");
                    setUploadProgress(0);
                  }
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                }}
              />
              {uploadProgress > 0 && (
                <Progress value={uploadProgress} className="mt-2" />
              )}
            </div>

            {groundPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {groundPhotos.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Venue ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1"
                      onClick={() =>
                        setGroundPhotos(groundPhotos.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentTab("slots")}
                className="flex-1"
              >
                ← Back
              </Button>
              <Button
                onClick={handleAddGround}
                disabled={creating || groundPhotos.length === 0}
                className="flex-1"
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {creating ? "Creating Venue..." : "Create Venue"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AddGround;
