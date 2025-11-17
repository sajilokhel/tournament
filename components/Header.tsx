"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import Auth from "@/components/Auth";
import { useAuth } from "@/contexts/AuthContext";

const Header = () => {
  const { user, loading, role } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 bg-white shadow-md">
      <Link href="/" className="text-2xl font-bold text-green-600">
        Futsal Booking
      </Link>
      <nav className="flex items-center gap-4">
        <Link href="/" className="text-gray-600 hover:text-green-600">
          Home
        </Link>
        <Link href="/venues" className="text-gray-600 hover:text-green-600">
          Venues
        </Link>
        {user && (
          <Link
            href="/user/bookings"
            className="text-gray-600 hover:text-green-600"
          >
            My Bookings
          </Link>
        )}
        {/* Add Manager Dashboard link if user is a manager */}
        {role === "manager" && (
          <Link
            href="/manager/dashboard"
            className="text-gray-600 hover:text-green-600"
          >
            Manager Dashboard
          </Link>
        )}
      </nav>
      <div>
        <Auth />
      </div>
    </header>
  );
};

export default Header;
