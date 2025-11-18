"use client";

import { useState, useCallback } from "react";
import { MapPin, X, AlertCircle, Navigation, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LocationPermissionBannerProps {
  onPermissionGranted: (location: [number, number]) => void;
  onPermissionDenied: () => void;
  onDismiss?: () => void;
}

export const LocationPermissionBanner = ({
  onPermissionGranted,
  onPermissionDenied,
  onDismiss,
}: LocationPermissionBannerProps) => {
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied" | "loading" | "hidden" | "insecure"
  >("prompt");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    setPermissionState("loading");
    setError(null);

    if (!window.isSecureContext) {
      setPermissionState("insecure");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setPermissionState("denied");
      onPermissionDenied();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Validate coordinates before passing them
        if (isNaN(latitude) || isNaN(longitude)) {
          console.error("Invalid coordinates received:", latitude, longitude);
          setError("Invalid location data received.");
          setPermissionState("denied");
          onPermissionDenied();
          return;
        }
        
        setPermissionState("granted");
        onPermissionGranted([latitude, longitude]);
        // Hide banner after successful grant
        setTimeout(() => {
          setPermissionState("hidden");
          onDismiss?.();
        }, 1500);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setPermissionState("denied");
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError("Location permission denied. You can still browse venues manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            setError("Location information unavailable.");
            break;
          case error.TIMEOUT:
            setError("Location request timed out.");
            break;
          default:
            setError("An unknown error occurred.");
        }
        
        onPermissionDenied();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onPermissionGranted, onPermissionDenied, onDismiss]);

  const handleDismiss = () => {
    setPermissionState("hidden");
    onDismiss?.();
  };

  if (permissionState === "hidden" || permissionState === "granted") {
    return null;
  }

  // Insecure context (HTTP on mobile)
  if (permissionState === "insecure") {
    const isLocalNetwork = window.location.hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost)/);
    
    return (
      <Card className="mb-4 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
        <div className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-orange-600 dark:text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 dark:text-orange-100">
              Secure Connection Required
            </h3>
            <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
              Location access requires a secure HTTPS connection on mobile devices.
            </p>
            {isLocalNetwork && (
              <div className="mt-3 space-y-2 text-xs text-orange-700 dark:text-orange-300">
                <p className="font-medium">💡 For Development:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">localhost</code> instead of IP address</li>
                  <li>Set up local HTTPS with self-signed certificate</li>
                  <li>Deploy to HTTPS hosting (Vercel, Netlify, etc.)</li>
                </ul>
              </div>
            )}
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
              You can still search for venues manually.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  if (permissionState === "denied" || error) {
    return (
      <Card className="mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
        <div className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">
              Location Access Unavailable
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              {error || "We couldn't access your location. You can still search for venues manually."}
            </p>
            {permissionState === "denied" && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                💡 To enable location: Check your browser settings → Site permissions → Location
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  if (permissionState === "loading") {
    return (
      <Card className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <div className="p-4 flex items-center gap-3">
          <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-500 animate-pulse" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Getting your location...
          </p>
        </div>
      </Card>
    );
  }

  // Default: prompt state
  return (
    <Card className="mb-4 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
      <div className="p-4 flex items-start gap-3">
        <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-2">
          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            Find Venues Near You
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            Allow location access to discover nearby futsal venues and get accurate distances.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={requestLocation}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Enable Location
            </Button>
            <Button
              onClick={() => {
                setPermissionState("hidden");
                onPermissionDenied();
                onDismiss?.();
              }}
              variant="outline"
              size="sm"
            >
              Skip
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
