"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Upload, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ImageManagerProps {
  images: string[];
  onImagesChange: (newImages: string[]) => void;
}

const ImageManager = ({ images, onImagesChange }: ImageManagerProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    toast.success("Image removed");
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      // For now, we'll use a simple file reader to convert to data URLs
      // In production, you should upload to a proper file storage service
      const filePromises = Array.from(files).map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const newImageUrls = await Promise.all(filePromises);
      onImagesChange([...images, ...newImageUrls]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <Card
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-move overflow-hidden ${
                draggedIndex === index ? "opacity-50" : ""
              }`}
            >
              <div className="aspect-square relative">
                <img
                  src={image}
                  alt={`Venue image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Drag Handle */}
                <div className="absolute top-2 left-2 bg-black/60 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-white" />
                </div>

                {/* Primary Badge */}
                {index === 0 && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
                    Primary
                  </div>
                )}

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Button */}
      <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
        <div className="p-8 text-center">
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <label
            htmlFor="image-upload"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors ${
              isUploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload Images
              </>
            )}
          </label>
          <p className="text-sm text-gray-500 mt-4">
            Drag to reorder • First image will be the primary display
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Supported formats: JPG, PNG, GIF (Max 5MB each)
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ImageManager;
