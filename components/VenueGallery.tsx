"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface VenueGalleryProps {
  imageUrls: string[];
  venueName: string;
}

const VenueGallery = ({ imageUrls, venueName }: VenueGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  if (!imageUrls || imageUrls.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto bg-gray-300 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">No images available</p>
        </div>
      </div>
    );
  }

  const selectedImage = imageUrls[selectedIndex];

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image with Navigation */}
      <div className="relative group">
        <div className="relative overflow-hidden rounded-xl bg-gray-50 h-[500px] border border-gray-200">
          <img
            src={selectedImage}
            alt={`${venueName} - Image ${selectedIndex + 1}`}
            className="w-full h-full object-cover"
          />
          
          {/* Zoom Button */}
          <button
            onClick={() => setIsZoomOpen(true)}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white p-2 rounded-lg shadow-lg transition-all opacity-0 group-hover:opacity-100"
            aria-label="Zoom image"
          >
            <Maximize2 className="w-5 h-5 text-gray-700" />
          </button>

          {/* Navigation Arrows */}
          {imageUrls.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {imageUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
              {selectedIndex + 1} / {imageUrls.length}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail Strip */}
      {imageUrls.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {imageUrls.map((image: string, index: number) => (
            <button
              key={index}
              className={`relative flex-shrink-0 w-20 h-20 overflow-hidden rounded-lg transition-all ${
                selectedIndex === index
                  ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-105"
                  : "ring-1 ring-gray-200 hover:ring-gray-300 opacity-70 hover:opacity-100"
              }`}
              onClick={() => setSelectedIndex(index)}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={image}
                alt={`${venueName} thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Dialog */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-7xl w-full p-0 bg-black/95">
          <div className="relative w-full h-[90vh]">
            <img
              src={selectedImage}
              alt={`${venueName} - Full size`}
              className="w-full h-full object-contain"
            />
            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 p-3 rounded-full transition-all"
                >
                  <ChevronLeft className="w-8 h-8 text-white" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 p-3 rounded-full transition-all"
                >
                  <ChevronRight className="w-8 h-8 text-white" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VenueGallery;
