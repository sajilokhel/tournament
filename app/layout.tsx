import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sajilokhel.com"),
  title: {
    default: "Sajilokhel | Book Sports Grounds in Nepal",
    template: "%s | Sajilokhel",
  },
  description:
    "Nepal's sports ground booking platform. Book futsal, cricket, badminton, basketball courts and more — real-time availability, secure eSewa payments, and instant confirmation for players and venue owners.",
  keywords: ["futsal", "sports booking", "ground booking", "cricket", "badminton", "basketball", "nepal", "kathmandu", "sajilokhel"],
  authors: [{ name: "Sajilokhel Team" }],
  creator: "Sajilokhel",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/logo_no_bg.png", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/logo_no_bg.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sajilokhel.com",
    title: "Sajilokhel | Book Sports Grounds in Nepal",
    description:
      "Nepal's sports ground booking platform. Find and book futsal, cricket, badminton courts and more with real-time availability and secure payments.",
    siteName: "Sajilokhel",
    images: [
      {
        url: "/openGraphImage.png",
        width: 1200,
        height: 630,
        alt: "Sajilokhel - Venue Booking Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sajilokhel | Book Sports Grounds in Nepal",
    description:
      "Nepal's sports ground booking platform. Find and book futsal, cricket, badminton courts and more with real-time availability and secure payments.",
    images: ["/openGraphImage.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Script id="structured-data" strategy="afterInteractive" type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Sajilokhel",
            url: "https://sajilokhel.com",
            logo: "https://sajilokhel.com/logo_no_bg.png",
            sameAs: [
              "https://www.facebook.com/sajilokhel",
              "https://www.instagram.com/sajilokhel",
            ],
            contactPoint: [
              {
                "@type": "ContactPoint",
                telephone: "+977-1-0000000",
                contactType: "customer support",
                areaServed: "NP",
                availableLanguage: "English",
              },
            ],
          })}
        </Script>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-inline" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');`}
            </Script>
          </>
        )}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
