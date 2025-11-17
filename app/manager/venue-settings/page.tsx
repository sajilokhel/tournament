"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  DocumentData,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";

const VenueSettingsPage = () => {
  const { user } = useAuth();
  const [venue, setVenue] = useState<DocumentData | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    price: "",
  });
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVenueDetails = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const venuesQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid)
      );
      const venueSnapshot = await getDocs(venuesQuery);

      if (venueSnapshot.empty) {
        throw new Error("You are not assigned to manage any venues.");
      }

      const venueDoc = venueSnapshot.docs[0];
      setVenueId(venueDoc.id);
      const venueData = venueDoc.data();
      setVenue(venueData);
      setFormData({
        name: venueData.name || "",
        address: venueData.address || "",
        price: venueData.price ? venueData.price.toString() : "",
      });
    } catch (err: any) {
      setError(err.message || "Could not load venue details.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVenueDetails();
    }
  }, [user, fetchVenueDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId) return;

    setIsUpdating(true);
    try {
      const priceAsNumber = parseFloat(formData.price);
      if (isNaN(priceAsNumber) || priceAsNumber < 0) {
        throw new Error("Please enter a valid, non-negative price.");
      }

      const venueRef = doc(db, "venues", venueId);
      await updateDoc(venueRef, {
        name: formData.name,
        address: formData.address,
        price: priceAsNumber,
      });

      toast.success("Venue details updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update details.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Loading settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 p-6 rounded-lg">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive">
          An Error Occurred
        </h2>
        <p className="text-center text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Venue Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Update Your Venue Details</CardTitle>
          <CardDescription>
            Keep your venue information up to date for your customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Venue Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="E.g., Downtown Futsal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="E.g., 123 Main St, Anytown"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price Per Slot (in Rs.)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="E.g., 1500"
                required
              />
            </div>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VenueSettingsPage;
