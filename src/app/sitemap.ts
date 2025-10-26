import type { MetadataRoute } from 'next'

const baseUrl = 'https://uolink.com'

const staticRoutes: string[] = [
  '/',
  '/about',
  '/contributions',
  '/leaderboard',
  '/hall-of-fame',
  '/donate',
  '/upload',
  '/note',
  '/aura',
  '/userpage',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.6,
  }))
}
