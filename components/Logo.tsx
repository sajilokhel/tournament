"use client";

import Link from "next/link";
import Image from "next/image";

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <Link href="/" className={`flex items-center gap-3 group ${className || ""}`}>
      <div className="relative w-10 h-10">
        {/* Outer Glow on Hover */}
        <div className="absolute -inset-2 bg-orange-500/30 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        <Image
          src="/icons/logo.png"
          alt="Sajilokhel Logo"
          width={40}
          height={40}
          className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500 ease-out"
        />
      </div>

      <div className="flex flex-col justify-center -space-y-1 select-none">
        <span className="font-extrabold text-2xl tracking-tight text-gray-900 dark:text-white leading-none font-sans transition-colors">
          Sajilo<span className="text-orange-500">khel</span>
        </span>
        <div className="overflow-hidden h-3 relative">
          <span className="absolute top-0 left-0 text-[0.65rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 delay-75">
            Nepal
          </span>
        </div>
      </div>
    </Link>
  );
};
