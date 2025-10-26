import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import Navbar from '@/components/Navbar'

export default function ProfileNotFound() {
    return (
        <div className="w-full">
            <Navbar />
            <main className="w-full bg-[#f6f9ee] min-h-screen">
                <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>

                    <div className="mt-12 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-lime-100">
                            <User className="h-12 w-12 text-[#90c639]" />
                        </div>
                        
                        <h1 className="mt-6 text-3xl font-bold text-[#1f2f10]">
                            Profile Not Found
                        </h1>
                        
                        <p className="mt-4 text-lg text-[#4c5c3c]">
                            The profile you're looking for doesn't exist or has been moved.
                        </p>
                        
                        <div className="mt-8 space-y-4">
                            <p className="text-sm text-[#5f7050]">
                                This could happen if:
                            </p>
                            <ul className="text-sm text-[#5f7050] space-y-2">
                                <li>• The username was typed incorrectly</li>
                                <li>• The user changed their username</li>
                                <li>• The profile was deleted</li>
                            </ul>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center rounded-full bg-[#90c639] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#7ab32e]"
                            >
                                Go to Home
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="inline-flex items-center justify-center rounded-full border border-[#90c639] bg-white px-6 py-3 text-sm font-medium text-[#90c639] shadow-sm transition hover:bg-lime-50"
                            >
                                Browse Profiles
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}