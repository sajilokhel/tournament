"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const GITHUB_REPO = "sajilokhel/fursal_mobile";

// Official Google Play badge
function GooglePlayBadge() {
  return (
    <svg viewBox="0 0 155 46" xmlns="http://www.w3.org/2000/svg" className="h-11 w-auto">
      <rect width="155" height="46" rx="6" fill="#000"/>
      <text x="50" y="16" fill="#aaa" fontSize="8" fontFamily="Arial, sans-serif">GET IT ON</text>
      <text x="50" y="33" fill="#fff" fontSize="16" fontFamily="Arial, sans-serif" fontWeight="bold">Google Play</text>
      {/* Play triangle — brand colours */}
      <polygon points="14,10 14,36 28,23" fill="url(#gp-grad-a)"/>
      <polygon points="14,10 34,23 28,23" fill="url(#gp-grad-b)"/>
      <polygon points="14,36 34,23 28,23" fill="url(#gp-grad-c)"/>
      <polygon points="28,23 34,23 14,10 14,12" fill="url(#gp-grad-d)"/>
      <defs>
        <linearGradient id="gp-grad-a" x1="14" y1="23" x2="28" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00C3FF"/><stop offset="1" stopColor="#1BE2FA"/>
        </linearGradient>
        <linearGradient id="gp-grad-b" x1="14" y1="10" x2="34" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2AF598"/><stop offset="1" stopColor="#08AEEA"/>
        </linearGradient>
        <linearGradient id="gp-grad-c" x1="14" y1="36" x2="34" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF6034"/><stop offset="1" stopColor="#EE0979"/>
        </linearGradient>
        <linearGradient id="gp-grad-d" x1="14" y1="11" x2="34" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD000"/><stop offset="1" stopColor="#FF8C00"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Official App Store badge
function AppStoreBadge() {
  return (
    <svg viewBox="0 0 155 46" xmlns="http://www.w3.org/2000/svg" className="h-11 w-auto">
      <rect width="155" height="46" rx="6" fill="#000"/>
      <text x="50" y="16" fill="#aaa" fontSize="8" fontFamily="Arial, sans-serif">Download on the</text>
      <text x="50" y="33" fill="#fff" fontSize="16" fontFamily="Arial, sans-serif" fontWeight="bold">App Store</text>
      {/* Apple logo */}
      <path d="M30.5 23.2c-.03-3.1 2.54-4.6 2.66-4.67-1.45-2.12-3.7-2.4-4.5-2.43-1.9-.2-3.73 1.13-4.7 1.13-.98 0-2.47-1.11-4.07-1.08-2.07.03-3.99 1.22-5.05 3.08-2.18 3.77-.55 9.31 1.54 12.35 1.04 1.49 2.27 3.16 3.88 3.1 1.56-.06 2.15-1 4.04-1 1.87 0 2.42 1 4.06.96 1.68-.03 2.74-1.5 3.75-3 1.19-1.71 1.67-3.38 1.7-3.47-.04-.02-3.28-1.27-3.31-5.97z" fill="#fff"/>
      <path d="M27.3 14.3c.87-1.04 1.45-2.49 1.29-3.93-1.25.05-2.76.83-3.65 1.86-.8.92-1.5 2.39-1.31 3.79 1.39.1 2.81-.71 3.67-1.72z" fill="#fff"/>
    </svg>
  );
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  assets: ReleaseAsset[];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DownloadPage() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((r) => r.json())
      .then((data) => { if (data?.tag_name) setRelease(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const apk = release?.assets.find((a) => a.name === "SajiloKhel.apk");
  const ipa = release?.assets.find((a) => a.name === "SajiloKhel.ipa");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Hero — clean, minimal */}
      <div className="pt-28 pb-16 px-6 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#111]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[22px] bg-orange-500 shadow-xl shadow-orange-500/20 mb-6">
            <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            SajiloKhel
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-5">
            Book sports grounds across Nepal — instantly, from your phone.
          </p>
          {loading ? (
            <div className="inline-block w-44 h-7 rounded-full bg-gray-100 dark:bg-white/5 animate-pulse" />
          ) : release ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="font-medium text-gray-700 dark:text-gray-200">{release.tag_name}</span>
              <span className="text-gray-300 dark:text-white/20">·</span>
              <span>{formatDate(release.published_at)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Direct Download</p>

        {/* APK */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/8 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#d8f4e3] dark:bg-[#172e22] flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-[#3ddc84]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C7.28 3.28 6.5 4.82 6.5 6.5h11c0-1.69-.78-3.22-1.97-4.34zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-white">Android APK</span>
              {apk && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{formatBytes(apk.size)}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Android 7.0+ · Enable "Install unknown apps" first</p>
          </div>
          {loading ? (
            <div className="w-24 h-9 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse shrink-0" />
          ) : apk ? (
            <a href={apk.browser_download_url} download
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3ddc84] hover:bg-[#34c277] text-black font-semibold text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          ) : (
            <span className="text-sm text-gray-400 shrink-0">Not available</span>
          )}
        </div>

        {/* IPA */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/8 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#e8e8f0] dark:bg-[#1e1e2e] flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-white">iOS IPA</span>
              {ipa && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{formatBytes(ipa.size)}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">iOS 13+ · Requires AltStore or sideloading</p>
          </div>
          {loading ? (
            <div className="w-24 h-9 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse shrink-0" />
          ) : ipa ? (
            <a href={ipa.browser_download_url} download
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200 text-white dark:text-black font-semibold text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          ) : (
            <span className="text-sm text-gray-400 shrink-0">Not available</span>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex-1 border-t border-gray-200 dark:border-white/8" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Coming soon</span>
          <div className="flex-1 border-t border-gray-200 dark:border-white/8" />
        </div>

        {/* Play Store */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/8 rounded-2xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed select-none">
          <GooglePlayBadge />
          <div className="flex-1" />
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/40 px-3 py-1 rounded-full font-medium shrink-0">
            Coming soon
          </span>
        </div>

        {/* App Store */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/8 rounded-2xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed select-none">
          <AppStoreBadge />
          <div className="flex-1" />
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/40 px-3 py-1 rounded-full font-medium shrink-0">
            Coming soon
          </span>
        </div>

        <div className="pt-4 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
