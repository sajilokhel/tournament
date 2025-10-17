"use client";

import React from "react";
import { Trophy } from "lucide-react";
import Link from "next/link";

interface AuthPageLayoutProps {
  heroImage: string;
  heroTitle: string;
  heroDescription: string;
  heroAlt?: string;
  children: React.ReactNode;
}

/**
 * AuthPageLayout
 *
 * Reusable layout for all auth pages (login/register for all roles).
 * Provides a clean two-column design:
 * - Left: Branding header + Form area with clean spacing
 * - Right: Full-height hero image with overlay and caption
 *
 * Usage:
 * <AuthPageLayout
 *   heroImage="/images/placeholder-login.jpg"
 *   heroTitle="Welcome back"
 *   heroDescription="Sign in to manage your bookings"
 * >
 *   <LoginForm />
 * </AuthPageLayout>
 */
export default function AuthPageLayout({
  heroImage,
  heroTitle,
  heroDescription,
  heroAlt = "Hero illustration",
  children,
}: AuthPageLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left: Form area with branding */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Branding/Logo Header */}

        {/* Form Container - Centered */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Right: Hero image column - hidden on mobile, visible on lg+ screens */}
      <div className="relative hidden bg-muted lg:block">
        <img
          src={heroImage}
          alt={heroAlt}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />

        {/* Gradient overlay - heavily focused on bottom for darker background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 via-40% to-black/10" />

        {/* Hero caption */}
        <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            {heroTitle}
          </h2>
          <p className="text-lg text-white/90 max-w-md">{heroDescription}</p>
        </div>
      </div>
    </div>
  );
}
