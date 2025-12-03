import { MetadataRoute } from 'next'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
 
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://sajilokhel.com'
  
  // Static routes
  const routes = [
    '',
    '/auth/login',
    '/auth/register',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1,
  }))

  // Fetch venues for dynamic routes
  // Note: In a real build, we might want to limit this or paginate, 
  // but for now we'll fetch all active venues
  let venueRoutes: MetadataRoute.Sitemap = []
  
  try {
    const venuesRef = collection(db, 'venues')
    // Assuming we only want to index approved/active venues if there's such a status
    // For now, fetching all
    const snapshot = await getDocs(venuesRef)
    
    venueRoutes = snapshot.docs.map((doc) => ({
      url: `${baseUrl}/venue/${doc.id}`,
      lastModified: new Date(), // Ideally this comes from doc.updatedAt
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (error) {
    console.error('Error generating sitemap for venues:', error)
  }

  return [...routes, ...venueRoutes]
}
