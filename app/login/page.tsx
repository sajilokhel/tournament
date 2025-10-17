import { GalleryVerticalEnd } from "lucide-react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Form area - centered and using full height */}
      <div className="flex flex-col justify-center p-6 md:p-12">
        {/* Branding / header */}
        <div className="mb-6">
          <a href="/" className="flex items-center gap-3 font-medium">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex w-10 h-10 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <span className="text-lg font-semibold block">Futsal</span>
              <span className="text-xs text-muted-foreground block">
                Book your court
              </span>
            </div>
          </a>
        </div>

        {/* Form container - allow wider form and prevent overflow */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right: Illustration / placeholder - show only on large screens */}
      <div className="relative hidden lg:flex items-center justify-center bg-gray-50 overflow-hidden">
        <img
          src="/placeholder.svg"
          alt="Illustration"
          className="w-full h-full object-cover"
        />
        {/* subtle overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
        <div className="absolute left-12 bottom-12 text-white max-w-sm pointer-events-none">
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="mt-2 text-sm">
            Sign in to manage your bookings and view your history.
          </p>
        </div>
      </div>
    </div>
  );
}
