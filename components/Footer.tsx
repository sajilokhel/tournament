"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  const [year, setYear] = useState(2025); // Default year for SSR

  useEffect(() => {
    // Update year on client side only
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-gray-100 dark:bg-black border-t border-gray-200 dark:border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sajilokhel</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Nepal's premier futsal booking platform. Book your game in seconds.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-orange-500 hover:text-white transition-all"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-orange-500 hover:text-white transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-orange-500 hover:text-white transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/venues"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                >
                  Browse Venues
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                >
                  Sign Up
                </Link>
              </li>
              <li>
                <Link
                  href="/user/bookings"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                >
                  My Bookings
                </Link>
              </li>
            </ul>
          </div>

          {/* For Owners */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              For Owners
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/auth/register"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                >
                  List Your Venue
                </Link>
              </li>
              <li>
                <Link
                  href="/manager/dashboard"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                >
                  Manager Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Contact
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Kathmandu, Nepal</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a href="tel:+9779800000000" className="hover:text-orange-500 transition-colors">
                  +977 980-0000000
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a href="mailto:contact@sajilokhel.com" className="hover:text-orange-500 transition-colors">
                  contact@sajilokhel.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
            © {year} Sajilokhel. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-gray-500 dark:text-gray-400">
            <Link href="#" className="hover:text-orange-500 transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-orange-500 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
