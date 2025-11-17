"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";

// Dynamically import the single, unified map component with SSR disabled
const VenueMap = dynamic(() => import("@/components/venueMap"), {
  ssr: false,
  loading: () => <p className="text-center">Loading map...</p>,
});

const Home = () => {
  const { role } = useAuth();

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center my-8">
        {role === "manager"
          ? "My Futsal Dashboard"
          : "Find and Book a Futsal Ground"}
      </h1>

      {/* Always render the unified VenueMap for all users */}
      <VenueMap />
    </main>
  );
};

export default Home;
