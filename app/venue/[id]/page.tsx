import { Metadata } from "next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import VenueClient from "./VenueClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const docRef = doc(db, "venues", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const venue = docSnap.data();
      return {
        title: venue.name,
        description: venue.description || `Book ${venue.name} on Sajilokhel`,
        openGraph: {
          title: venue.name,
          description: venue.description || `Book ${venue.name} on Sajilokhel`,
          images: venue.images?.[0] ? [venue.images[0]] : [],
        },
      };
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  return {
    title: "Venue Details",
    description: "View venue details and book your slot.",
  };
}

export default async function VenuePage({ params }: Props) {
  const { id } = await params;
  return <VenueClient id={id} />;
}
