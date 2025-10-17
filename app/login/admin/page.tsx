import { GalleryVerticalEnd } from "lucide-react";

import { AdminLoginForm } from "@/components/admin-login-form";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen grid lg:grid-cols-2">
      {/* Left: Form area - centered and using full height */}
      <div className="relative z-20 flex flex-col justify-center p-6 md:p-12">
        {/* Form container - allow wider form and prevent overflow; add readable backdrop */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/85 rounded-lg shadow-lg p-6 backdrop-blur-md">
            <AdminLoginForm />
          </div>
        </div>
      </div>

      {/* Full-bleed hero image (covers entire page, including left area) */}
      <div className="absolute inset-0 hidden lg:block z-0">
        <img
          src="/images/placeholder-admin.jpg"
          alt="Illustration: admin dashboard"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          aria-hidden="true"
        />
        {/* stronger overlay to ensure contrast beneath the form */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute right-12 bottom-12 text-white max-w-sm pointer-events-none z-10">
          <h2 className="text-2xl font-bold">Admin Sign in</h2>
          <p className="mt-2 text-sm">
            Sign in with your admin credentials to access the system dashboard
            and manage the platform.
          </p>
        </div>
      </div>
    </div>
  );
}
