"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

interface VenueDetailsProps {
  description: string;
  attributes?: Record<string, string>;
}

const VenueDetails = ({ description, attributes }: VenueDetailsProps) => {
  return (
    <div className="space-y-6">
      {/* Description */}
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">About this Venue</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{description}</p>
        </CardContent>
      </Card>

      {/* Extra Features */}
      {attributes && Object.keys(attributes).length > 0 && (
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Features & Amenities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(attributes).map(([key, value]) => (
                <div 
                  key={key} 
                  className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{key}</p>
                    <p className="text-sm text-gray-600">{value as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VenueDetails;
