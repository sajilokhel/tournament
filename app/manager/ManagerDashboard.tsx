"use client";

import VenueMap from "@/components/venueMap";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";
import VenueList from "@/components/VenueList";

const ManagerDashboard = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <VenueMap />
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">My Grounds</h2>
        <VenueList />
      </div>
    </div>
  );
};

export default ManagerDashboard;
