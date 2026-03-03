"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";

const HomePageMap = dynamic(() => import("@/components/HomePageMap"), { ssr: false });

// Icon Components
const MapIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

enum UserRole {
  PLAYER = "PLAYER",
  OWNER = "OWNER",
}

const Home = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<UserRole>(UserRole.PLAYER);
  const [searchQuery, setSearchQuery] = useState("");

  // Live activity stats
  const [venueCount, setVenueCount] = useState<number | null>(null);
  const [activeBookingCount, setActiveBookingCount] = useState<number | null>(null);
  const [recentInitials, setRecentInitials] = useState<string[]>([]);

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        // Venue count
        const venueSnap = await getDocs(collection(db, "venues"));
        setVenueCount(venueSnap.size);

        // Active bookings (confirmed / pending_payment)
        const bookingSnap = await getDocs(
          query(
            collection(db, "bookings"),
            where("status", "in", ["confirmed", "CONFIRMED", "pending_payment"]),
            limit(500)
          )
        );
        setActiveBookingCount(bookingSnap.size);

        // Recent unique booker initials (up to 3)
        const recentSnap = await getDocs(
          query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(20))
        );
        const seen = new Set<string>();
        const initials: string[] = [];
        recentSnap.docs.forEach((d) => {
          const data = d.data() as any;
          const name: string = data.customerName || data.userName || data.userId || "?";
          const initial = name.trim().charAt(0).toUpperCase();
          if (!seen.has(initial) && initials.length < 3) {
            seen.add(initial);
            initials.push(initial);
          }
        });
        setRecentInitials(initials);
      } catch {
        // silently ignore — stats are non-critical
      }
    };
    fetchLiveStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/venues?search=${encodeURIComponent(searchQuery)}`);
  };

  const quickSearch = (term: string) => {
    router.push(`/venues?search=${encodeURIComponent(term)}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-orange-100/50 to-transparent dark:from-orange-900/20 dark:to-transparent opacity-60 transition-colors duration-500" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 dark:bg-orange-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gray-300/20 dark:bg-gray-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 backdrop-blur-sm shadow-sm dark:shadow-none">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                <span className="text-sm font-medium text-gray-900 dark:text-orange-100">
                  Live in Kathmandu & Pokhara
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white">
                Book Sports Grounds in Nepal {" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-400 dark:from-orange-500 dark:to-orange-200">
                  Anytime, Anywhere
                </span>
              </h1>

              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-lg">
                Nepal&apos;s sports ground booking platform. Futsal, cricket, badminton, basketball
                find availability, book instantly, and pay securely. No calls, no hassle.
              </p>

              {/* Search Bar */}
              <div className="w-full max-w-md relative z-20 pb-2">
                <form onSubmit={handleSearch} className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-500"></div>

                  <div className="relative flex items-center bg-white/80 dark:bg-black/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-full p-1.5 focus-within:border-orange-500/50 transition-all shadow-xl dark:shadow-2xl">
                    <div className="pl-4 text-gray-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 focus:ring-0 px-3 py-3 outline-none w-full font-medium"
                      placeholder="Search venue, location..."
                    />
                    <button
                      type="submit"
                      className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 py-2.5 font-bold transition-all duration-300 shadow-lg shadow-orange-500/20 flex items-center gap-2 transform active:scale-95"
                    >
                      <span>Find</span>
                    </button>
                  </div>
                </form>
                <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-500 px-4 font-medium">
                  <span>Popular:</span>
                  <button
                    type="button"
                    onClick={() => quickSearch("Kathmandu")}
                    className="hover:text-orange-500 transition-colors underline decoration-dotted"
                  >
                    Kathmandu
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSearch("Badminton")}
                    className="hover:text-orange-500 transition-colors underline decoration-dotted"
                  >
                    Badminton
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSearch("Cricket")}
                    className="hover:text-orange-500 transition-colors underline decoration-dotted"
                  >
                    Cricket
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a
                  href="/auth/register"
                  className="inline-flex items-center justify-center px-6 py-3 text-base rounded-full font-semibold transition-all duration-300 bg-gray-100 dark:bg-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-100 border border-transparent"
                >
                  Join as Player
                </a>
                <a
                  href="/venues"
                  className="inline-flex items-center justify-center px-6 py-3 text-base rounded-full font-semibold transition-all duration-300 bg-transparent text-gray-700 dark:text-white border border-gray-300 dark:border-white/20 hover:border-orange-500 dark:hover:border-orange-500 hover:text-orange-500 dark:hover:text-orange-500"
                >
                  List Venue
                </a>
              </div>
            </div>

            {/* Hero Graphic */}
            <div className="w-full lg:w-1/2 relative">
              <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 group transform hover:scale-[1.02] transition-transform duration-500 h-[400px] sm:h-[500px]">
                <Image
                  src="https://images.unsplash.com/photo-1560272564-c83b66b1ad12?q=80&w=1949&auto=format&fit=crop"
                  alt="Futsal Player"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-30 dark:opacity-40" />

                {/* Live Activity Widget */}
                <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 bg-white/90 dark:bg-black/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl transition-colors">
                  <div className="flex items-center justify-between mb-3 sm:mb-4 border-b border-gray-200 dark:border-white/5 pb-2 sm:pb-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                      </span>
                      <span className="text-gray-900 dark:text-white font-bold tracking-wide">
                        Live Activity
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {recentInitials.length > 0 ? (
                        recentInitials.map((initial, i) => (
                          <div
                            key={i}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-black bg-orange-500 flex items-center justify-center text-[11px] font-bold text-white"
                          >
                            {initial}
                          </div>
                        ))
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-white dark:border-black bg-gray-300 dark:bg-gray-700" />
                      )}
                      {activeBookingCount !== null && activeBookingCount > 3 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white dark:border-black bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white dark:text-black">
                          {activeBookingCount > 99 ? "99+" : `${activeBookingCount - recentInitials.length}+`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {venueCount !== null ? venueCount : "—"}
                      </div>
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mt-1">
                        Venues
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-orange-500">
                        {activeBookingCount !== null ? activeBookingCount : "—"}
                      </div>
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mt-1">
                        Active Bookings
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <button
                        onClick={() => router.push("/venues")}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white dark:text-black text-[10px] sm:text-xs font-bold py-2 sm:py-3 px-2 sm:px-3 rounded-xl transition-all duration-300 transform hover:translate-y-[-2px] shadow-lg shadow-orange-500/20"
                      >
                        Book Fast
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative elements behind */}
              <div className="absolute -top-6 -right-6 w-full h-full border-2 border-orange-500/20 rounded-2xl -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Role Switcher Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 transition-colors">
              How Sajilokhel Works
            </h2>

            <div className="inline-flex bg-gray-200 dark:bg-white/5 p-1 rounded-full border border-gray-300 dark:border-white/10 backdrop-blur-sm transition-colors">
              <button
                onClick={() => setActiveTab(UserRole.PLAYER)}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                  activeTab === UserRole.PLAYER
                    ? "bg-white dark:bg-orange-500 text-gray-900 dark:text-white shadow-md"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                For Players
              </button>
              <button
                onClick={() => setActiveTab(UserRole.OWNER)}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                  activeTab === UserRole.OWNER
                    ? "bg-white dark:bg-orange-500 text-gray-900 dark:text-white shadow-md"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                For Venue Owners
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-12">
              {activeTab === UserRole.PLAYER ? (
                <>
                  <FeatureRow
                    icon={<MapIcon />}
                    title="Discover Nearby Venues"
                    desc="Open the interactive map to see all available grounds. Filter by price, rating, and facilities."
                  />
                  <FeatureRow
                    icon={<CalendarIcon />}
                    title="Instant Booking"
                    desc="Real-time slots means no more double booking. Pick your time, pay via eSewa, and you're set."
                  />
                  <FeatureRow
                    icon={<ShieldIcon />}
                    title="Earn Reputation"
                    desc="Show up, play fair, and build your player profile. Rate venues to help the community."
                  />
                </>
              ) : (
                <>
                  <FeatureRow
                    icon={<ChartIcon />}
                    title="Dashboard Analytics"
                    desc="Track peak hours, revenue, and customer retention with professional grade tools."
                  />
                  <FeatureRow
                    icon={<CalendarIcon />}
                    title="Schedule Management"
                    desc="Block maintenance hours, set holiday pricing, and manage multiple courts from one screen."
                  />
                  <FeatureRow
                    icon={<ShieldIcon />}
                    title="Verified Payments"
                    desc="No more 'I'll pay later'. Receive secure payments instantly upon booking confirmation."
                  />
                </>
              )}
            </div>

            <div className={`relative h-[500px] rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden group transition-colors ${activeTab === UserRole.OWNER ? "bg-gray-50 dark:bg-gray-950" : "bg-gray-100 dark:bg-gray-900"}`}>
              <img
                key={activeTab}
                src={
                  activeTab === UserRole.PLAYER
                    ? "https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1926&auto=format&fit=crop"
                    : "/manager_dashboard_view.png"
                }
                alt="Feature Preview"
                className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
                  activeTab === UserRole.OWNER ? "object-contain object-top p-4" : "object-cover"
                }`}
              />

              <div className={`absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t ${activeTab === UserRole.OWNER ? "from-gray-50/95 via-gray-50/70 dark:from-gray-950/95 dark:via-gray-950/70" : "from-black via-black/60"} to-transparent`}>
                <h4 className={`text-2xl font-bold mb-2 ${activeTab === UserRole.OWNER ? "text-gray-900 dark:text-white" : "text-white"}`}>
                  {activeTab === UserRole.PLAYER ? "Game On." : "Business Growth."}
                </h4>
                <p className={activeTab === UserRole.OWNER ? "text-gray-600 dark:text-gray-400" : "text-gray-300"}>
                  {activeTab === UserRole.PLAYER
                    ? "Join thousands of players booking daily."
                    : "Maximize your venue utilization today."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-24 bg-gray-100/50 dark:bg-white/5 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white transition-colors">
              Built for Every Sport
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Not just a booking form. A complete sports ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-6 h-auto md:h-[600px]">
            {/* Large item - Map */}
            <div className="md:col-span-2 md:row-span-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl relative overflow-hidden group hover:border-orange-500/50 transition-colors shadow-lg dark:shadow-none">
              <div className="absolute inset-0">
                <HomePageMap />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/90 dark:from-black dark:via-black/90 to-transparent pointer-events-none z-[1000]">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  Interactive Map Tech
                </h3>
                <p className="text-gray-600 dark:text-gray-300 max-w-md">
                  Live venue map powered by OpenStreetMap. Spots your real location, shows all
                  available grounds nearby, and lets you click straight to booking.
                </p>
              </div>
            </div>

            {/* Small Item 1 */}
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-8 group hover:border-orange-500/50 transition-colors shadow-lg dark:shadow-none">
              <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/20 rounded-lg flex items-center justify-center mb-4 text-orange-600 dark:text-orange-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Secure Auth
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Google & Firebase integration keeps your account safe.
              </p>
            </div>

            {/* Small Item 2 */}
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-8 group hover:border-orange-500/50 transition-colors shadow-lg dark:shadow-none">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-500/20 rounded-lg flex items-center justify-center mb-4 text-gray-700 dark:text-gray-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Next.js Speed
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Lightning fast web app performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-orange-500/5 dark:bg-orange-500/5"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl font-black text-gray-900 dark:text-white mb-6 transition-colors">
            Ready to play?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 transition-colors">
            Join thousands of players booking sports grounds across Nepal.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-4 text-lg rounded-full font-semibold transition-all duration-300 bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 border border-transparent w-full sm:w-auto"
            >
              Create Player Account
            </a>
            <a
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-4 text-lg rounded-full font-semibold transition-all duration-300 bg-gray-100 dark:bg-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-100 border border-transparent w-full sm:w-auto"
            >
              Register Venue
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

// Helper Component for Feature Rows
const FeatureRow: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({
  icon,
  title,
  desc,
}) => (
  <div className="flex gap-6 group">
    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-orange-600 dark:text-orange-500 border border-gray-200 dark:border-white/10 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm dark:shadow-none">
      {icon}
    </div>
    <div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default Home;
