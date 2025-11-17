"use client";

import { useState } from "react";
import { LatLng } from "leaflet";
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
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";

interface Attribute {
  key: string;
  value: string;
}

const AddGround = ({
  newGroundLocation,
  isFormOpen,
  setIsFormOpen,
  fetchGrounds,
}: {
  newGroundLocation: LatLng | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  fetchGrounds: () => void;
}) => {
  const { user } = useAuth();
  const [groundName, setGroundName] = useState("");
  const [groundDescription, setGroundDescription] = useState("");
  const [groundPhotos, setGroundPhotos] = useState<string[]>([]);
  const [pricePerHour, setPricePerHour] = useState("");
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [creating, setCreating] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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

  const handleAddGround = async () => {
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
    setCreating(true);
    try {
      const newVenueRef = await addDoc(collection(db, "venues"), {
        name: groundName.trim(),
        description: groundDescription.trim() || null,
        latitude: newGroundLocation?.lat || null,
        longitude: newGroundLocation?.lng || null,
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

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { groundId: newVenueRef.id });

      setGroundName("");
      setGroundDescription("");
      setGroundPhotos([]);
      setPricePerHour("");
      setAttributes([]);
      setIsFormOpen(false);
      toast.success("Venue created and assigned to you.");
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
          <Input
            placeholder="Price per hour"
            type="number"
            value={pricePerHour}
            onChange={(e) => setPricePerHour(e.target.value)}
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
              button: "Choose Images (up to 5)",
            }}
            onUploadProgress={(progress) => {
              setUploadProgress(progress);
            }}
            onClientUploadComplete={(res) => {
              if (res) {
                const urls = res.map((r) => r.url);
                setGroundPhotos(urls);
                toast.success("Images uploaded successfully");
                setUploadProgress(0);
              }
            }}
            onUploadError={(error: Error) => {
              toast.error(`ERROR! ${error.message}`);
            }}
          />
          {uploadProgress > 0 && <Progress value={uploadProgress} />}
          {attributes.map((attr, index) => (
            <div key={index} className="flex space-x-2">
              <Input
                placeholder="Attribute"
                value={attr.key}
                onChange={(e) =>
                  handleAttributeChange(index, "key", e.target.value)
                }
              />
              <Input
                placeholder="Value"
                value={attr.value}
                onChange={(e) =>
                  handleAttributeChange(index, "value", e.target.value)
                }
              />
            </div>
          ))}
          <Button onClick={handleAddAttribute}>+ Add Attribute</Button>
          <Button
            onClick={handleAddGround}
            disabled={creating || groundPhotos.length === 0}
          >
            {creating ? "Adding..." : "Add Ground"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddGround;
