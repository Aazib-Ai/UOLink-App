import LeaderboardPage from '@/components/LeaderboardPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aura Leaderboard | UOLink',
  description: 'See the top contributors ranked by their aura points. Discover who\'s making the biggest impact in the community.',
}

export default function Leaderboard() {
  return <LeaderboardPage />
}