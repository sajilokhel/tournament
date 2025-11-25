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
    <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Fursal</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Nepal's premier futsal booking platform. Book your game in seconds.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-green-500 hover:text-white transition-all"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-green-500 hover:text-white transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-green-500 hover:text-white transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/venues"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors"
                >
                  Browse Venues
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors"
                >
                  Sign Up
                </Link>
              </li>
              <li>
                <Link
                  href="/user/bookings"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors"
                >
                  My Bookings
                </Link>
              </li>
            </ul>
          </div>

          {/* For Owners */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              For Owners
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/auth/register"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors"
                >
                  List Your Venue
                </Link>
              </li>
              <li>
                <Link
                  href="/manager/dashboard"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors"
                >
                  Manager Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Contact
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Kathmandu, Nepal</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a href="tel:+9779800000000" className="hover:text-green-500 transition-colors">
                  +977 980-0000000
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a href="mailto:info@fursal.com" className="hover:text-green-500 transition-colors">
                  info@fursal.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            © {year} Fursal. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-slate-500 dark:text-slate-400">
            <Link href="#" className="hover:text-green-500 transition-colors">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-green-500 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
