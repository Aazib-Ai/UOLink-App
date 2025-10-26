import PublicProfile from '@/components/PublicProfile'
import { isValidUsernameFormat } from '@/lib/firebase'
import { notFound } from 'next/navigation'

interface ProfilePageProps {
    params: Promise<{
        userName: string
    }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { userName } = await params
    
    // Validate username format before rendering
    if (!userName || !isValidUsernameFormat(userName)) {
        notFound()
    }
    
    return <PublicProfile />
}

// Generate metadata for the profile page
export async function generateMetadata({ params }: ProfilePageProps) {
    const { userName } = await params
    
    if (!userName || !isValidUsernameFormat(userName)) {
        return {
            title: 'Profile Not Found',
            description: 'The requested profile could not be found.'
        }
    }
    
    return {
        title: `${userName} - Profile | UoLink`,
        description: `View ${userName}'s profile and shared notes on UoLink.`,
        openGraph: {
            title: `${userName} - Profile | UoLink`,
            description: `View ${userName}'s profile and shared notes on UoLink.`,
            url: `/profile/${userName}`,
        }
    }
}