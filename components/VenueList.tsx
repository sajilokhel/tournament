"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Venue {
  id: string;
  name: string;
  address: string;
  facilities: string;
}

export default function VenueList() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVenues = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const q = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const venueList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Venue[];
      setVenues(venueList);
      setLoading(false);
    };
    fetchVenues();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading venues…</div>
      </div>
    );

  if (venues.length === 0)
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">
          You are not managing any venues yet.
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {venues.map((venue) => (
        <Card key={venue.id} className="min-h-[160px]">
          <CardHeader>
            <CardTitle>{venue.name}</CardTitle>
            <CardDescription>{venue.address}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{venue.facilities}</p>
          </CardContent>
          <CardFooter>
            <Link href={`/venue/${venue.id}`}>
              <Button>View Details</Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
