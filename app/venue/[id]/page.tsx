"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import ManagerPanel from "@/components/ManagerPanel";
import UserPanel from "@/components/UserPanel";

const VenuePage = () => {
  const { id } = useParams();
  const [venue, setVenue] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, role } = useAuth();

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        setIsLoading(true);
        const docRef = doc(db, "venues", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const venueData = { id: docSnap.id, ...docSnap.data() };
          setVenue(venueData);
        } else {
          setError("Venue not found");
        }
      } catch (err) {
        console.error("Error fetching venue:", err);
        setError("Failed to load venue");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchVenue();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <Skeleton className="h-96 w-full rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {error || "Venue not found"}
          </h1>
          <p className="text-gray-600 mt-2">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  const isManagerOfVenue =
    user && role === "manager" && venue.managedBy === user.uid;

  return (
    <div className="container mx-auto px-4 py-8">
      {isManagerOfVenue ? (
        <ManagerPanel venue={venue} />
      ) : (
        <UserPanel venue={venue} />
      )}
    </div>
  );
};

export default VenuePage;
