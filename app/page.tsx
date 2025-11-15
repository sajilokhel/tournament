"use client";

import dynamic from "next/dynamic";

const VenueMap = dynamic(() => import("@/components/venueMap"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Futsal Venues</h1>
      <VenueMap />
    </div>
  );
}
