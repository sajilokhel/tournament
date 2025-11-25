"use client";

import { useState } from "react";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, X, Eye, Edit, ImageIcon, Settings } from "lucide-react";
import ManagerGuard from "@/components/ManagerGuard";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";
import ImageManager from "@/components/ImageManager";
import LocationPicker from "@/components/LocationPicker";

interface ManagerPanelProps {
  venue: any;
}

const ManagerPanel = ({ venue }: ManagerPanelProps) => {
  const { id: paramId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Use venue.id if available (from prop), otherwise use paramId from URL
  const venueId = venue.id || paramId;

  const [formData, setFormData] = useState({
    name: venue.name || "",
    description: venue.description || "",
    pricePerHour: venue.pricePerHour || 0,
    address: venue.address || "",
    latitude: venue.latitude || 27.7172,
    longitude: venue.longitude || 85.3240,
    imageUrls: venue.imageUrls || [],
    attributes: venue.attributes || {},
  });

  const [newAttributeKey, setNewAttributeKey] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "pricePerHour"
          ? value === ""
            ? 0
            : parseInt(value, 10)
          : value,
    }));
  };

  const handleImagesChange = (newImages: string[]) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: newImages,
    }));
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleAddAttribute = () => {
    if (!newAttributeKey.trim() || !newAttributeValue.trim()) {
      toast.error("Please fill both key and value");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [newAttributeKey]: newAttributeValue,
      },
    }));

    setNewAttributeKey("");
    setNewAttributeValue("");
    toast.success("Feature added");
  };

  const handleRemoveAttribute = (key: string) => {
    setFormData((prev) => {
      const newAttributes = { ...prev.attributes };
      delete newAttributes[key];
      return {
        ...prev,
        attributes: newAttributes,
      };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Venue name is required");
      return;
    }

    if (formData.pricePerHour <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    try {
      setIsSaving(true);
      const venueRef = doc(db, "venues", venueId as string);
      await updateDoc(venueRef, {
        name: formData.name,
        description: formData.description,
        pricePerHour: formData.pricePerHour,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        imageUrls: formData.imageUrls,
        attributes: formData.attributes,
        updatedAt: serverTimestamp(),
      });

      toast.success("Venue updated successfully");
      setIsEditing(false);
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error("Error updating venue:", error);
      toast.error("Failed to update venue");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: venue.name || "",
      description: venue.description || "",
      pricePerHour: venue.pricePerHour || 0,
      address: venue.address || "",
      latitude: venue.latitude || 27.7172,
      longitude: venue.longitude || 85.3240,
      imageUrls: venue.imageUrls || [],
      attributes: venue.attributes || {},
    });
    setIsEditing(false);
  };

  return (
    <ManagerGuard>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Edit Button */}
        <div className="flex items-center justify-end">
          {!isEditing && activeTab === "overview" && (
            <Button onClick={() => setIsEditing(true)} size="lg">
              <Edit className="w-4 h-4 mr-2" />
              Edit Venue
            </Button>
          )}
        </div>

        <Separator />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto py-1 sm:h-12">
            <TabsTrigger value="overview" className="text-[10px] sm:text-base flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5 h-full">
              <Settings className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="text-[10px] sm:text-base flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5 h-full">
              <ImageIcon className="w-4 h-4" />
              <span>Images</span>
            </TabsTrigger>
            <TabsTrigger value="location" className="text-[10px] sm:text-base flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5 h-full">
              <Eye className="w-4 h-4" />
              <span>Location</span>
            </TabsTrigger>
            <TabsTrigger value="slots" className="text-[10px] sm:text-base flex-col sm:flex-row gap-1 sm:gap-2 py-2 sm:py-1.5 h-full">
              <Eye className="w-4 h-4" />
              <span>Availability</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {!isEditing ? (
              // View Mode
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Venue Name</label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formData.name}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Address</label>
                      <p className="text-gray-900 mt-1">
                        {formData.address || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Price per Hour</label>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        Rs. {formData.pricePerHour.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-line">
                      {formData.description || "No description provided"}
                    </p>
                  </CardContent>
                </Card>

                {Object.keys(formData.attributes).length > 0 && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Features & Amenities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(formData.attributes).map(([key, value]) => (
                          <div
                            key={key}
                            className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4"
                          >
                            <p className="text-sm font-semibold text-blue-900 mb-1">{key}</p>
                            <p className="text-sm text-gray-700">{value as string}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              // Edit Mode
              <Card>
                <CardHeader>
                  <CardTitle>Edit Venue Information</CardTitle>
                  <CardDescription>Update your venue details and features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Venue Name *
                      </label>
                      <Input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter venue name"
                        className="text-base"
                      />
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Price per Hour (Rs.) *
                      </label>
                      <Input
                        name="pricePerHour"
                        type="number"
                        value={formData.pricePerHour}
                        onChange={handleInputChange}
                        placeholder="Enter price"
                        min="1"
                        className="text-base"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Address
                    </label>
                    <Input
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Enter venue address"
                      className="text-base"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Description
                    </label>
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe your venue, facilities, and what makes it special..."
                      rows={5}
                      className="text-base resize-none"
                    />
                  </div>

                  <Separator />

                  {/* Extra Features */}
                  <div className="space-y-4">
                    <label className="text-sm font-semibold text-gray-700">
                      Features & Amenities
                    </label>

                    {/* Current Attributes */}
                    {Object.keys(formData.attributes).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(formData.attributes).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{key}</p>
                              <p className="text-sm text-gray-600">{value as string}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveAttribute(key)}
                              className="ml-3 text-red-500 hover:text-red-700 p-2"
                              aria-label={`Remove ${key}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Attribute */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6 space-y-3">
                        <p className="text-sm font-semibold text-blue-900 mb-3">
                          Add New Feature
                        </p>
                        <Input
                          placeholder="Feature name (e.g., WiFi, Parking)"
                          value={newAttributeKey}
                          onChange={(e) => setNewAttributeKey(e.target.value)}
                          className="bg-white"
                        />
                        <Input
                          placeholder="Details (e.g., Free high-speed WiFi available)"
                          value={newAttributeValue}
                          onChange={(e) => setNewAttributeValue(e.target.value)}
                          className="bg-white"
                        />
                        <Button
                          onClick={handleAddAttribute}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          Add Feature
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-6">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1"
                      size="lg"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      disabled={isSaving}
                      className="flex-1"
                      size="lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Venue Images</CardTitle>
                <CardDescription>
                  Upload, reorder, and manage your venue photos. The first image will be displayed as the primary image.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageManager
                  images={formData.imageUrls}
                  onImagesChange={handleImagesChange}
                />
                
                {formData.imageUrls.length !== venue.imageUrls.length && (
                  <div className="mt-6 flex gap-3">
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1" size="lg">
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Image Changes
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      disabled={isSaving}
                      className="flex-1"
                      size="lg"
                    >
                      Discard Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-6 mt-6">
            <LocationPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              onLocationChange={handleLocationChange}
            />
            
            {(formData.latitude !== venue.latitude || formData.longitude !== venue.longitude) && (
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={isSaving} className="flex-1" size="lg">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Location
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={isSaving}
                  className="flex-1"
                  size="lg"
                >
                  Discard Changes
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Slots Tab */}
          <TabsContent value="slots" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Availability</CardTitle>
                <CardDescription>
                  View and manage your venue's time slots and booking availability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklySlotsGrid groundId={venueId as string} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ManagerGuard>
  );
};

export default ManagerPanel;
