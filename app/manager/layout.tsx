"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ManagerLayoutProps {
  children: React.ReactNode;
}

const ManagerLayout = ({ children }: ManagerLayoutProps) => {
  const pathname = usePathname();
  const { user, loading } = useAuth(); // Assuming useAuth provides manager status

  // In a real app, you'd protect this route and fetch manager-specific data
  if (loading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  if (!user) {
    // This should be handled by middleware in a real app
    return <div>Access Denied. You must be logged in as a manager.</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h2 className="text-2xl font-bold mb-6">Manager Menu</h2>
        <nav>
          <ul>
            <li>
              <Link
                href="/manager/dashboard"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  pathname === "/manager/dashboard" ? "bg-gray-900" : ""
                }`}
              >
                <Home className="mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/manager/bookings"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  pathname.startsWith("/manager/bookings") ? "bg-gray-900" : ""
                }`}
              >
                <BarChart className="mr-3" />
                Bookings
              </Link>
            </li>
            <li>
              <Link
                href="/manager/venue-settings"
                className={`flex items-center p-2 rounded hover:bg-gray-700 ${
                  pathname.startsWith("/manager/venue-settings")
                    ? "bg-gray-900"
                    : ""
                }`}
              >
                <Settings className="mr-3" />
                Venue Settings
              </Link>
            </li>
            {/* Add more links as new manager pages are created */}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-gray-100">{children}</main>
    </div>
  );
};

export default ManagerLayout;
