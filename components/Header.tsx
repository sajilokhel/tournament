"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import Auth from "@/components/Auth";
import { useAuth } from "@/contexts/AuthContext";

const Header = () => {
  const { user, loading, role } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Hide header on auth pages (login/register for all user types)
  const isAuthPage =
    pathname?.startsWith("/auth/login") || pathname?.startsWith("/auth/register");

  if (isAuthPage) {
    return null;
  }

  const getLinkClass = (path: string) => {
    // For manager pages, check if pathname starts with /manager
    // For others, check exact match
    const isActive =
      path === "/manager" ? pathname?.startsWith("/manager") : pathname === path;

    return isActive
      ? "text-orange-500 font-medium"
      : "text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors";
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/5 py-4 shadow-sm dark:shadow-none"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Logo />

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className={`text-sm font-medium ${getLinkClass("/")}`}>
            Home
          </Link>
          {role === "manager" ? (
            <Link
              href="/manager/dashboard"
              className={`text-sm font-medium ${getLinkClass("/manager")}`}
            >
              Manager Dashboard
            </Link>
          ) : (
            <>
              <Link href="/venues" className={`text-sm font-medium ${getLinkClass("/venues")}`}>
                Venues
              </Link>
              {user && (
                <Link
                  href="/user/bookings"
                  className={`text-sm font-medium ${getLinkClass("/user/bookings")}`}
                >
                  My Bookings
                </Link>
              )}
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <div className="h-6 w-px bg-gray-200 dark:bg-white/10"></div>
          <Auth />
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          <button
            className="text-gray-900 dark:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16m-7 6h7"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-black border-b border-gray-200 dark:border-white/10 shadow-2xl max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="p-6 flex flex-col gap-4">
            <Link href="/" className={`text-lg font-medium py-2 ${getLinkClass("/")}`}>
              Home
            </Link>
            {role === "manager" ? (
              <Link
                href="/manager/dashboard"
                className={`text-lg font-medium py-2 ${getLinkClass("/manager")}`}
              >
                Manager Dashboard
              </Link>
            ) : (
              <>
                <Link href="/venues" className={`text-lg font-medium py-2 ${getLinkClass("/venues")}`}>
                  Venues
                </Link>
                {user && (
                  <Link
                    href="/user/bookings"
                    className={`text-lg font-medium py-2 ${getLinkClass("/user/bookings")}`}
                  >
                    My Bookings
                  </Link>
                )}
              </>
            )}
            <div className="border-t border-gray-200 dark:border-white/10 pt-4 mt-2">
              <Auth />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Header;
