import React from 'react';
import { PersonalizedFeed } from './PersonalizedFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useSplash } from '@/contexts/SplashContext';
import DashboardSkeleton from '../skeletons/DashboardSkeleton';

interface PersonalizedDashboardProps {
    className?: string;
}

export const PersonalizedDashboard: React.FC<PersonalizedDashboardProps> = ({ 
    className = '' 
}) => {
    const { user, loading: authLoading } = useAuth();
    const { isSplashComplete } = useSplash();

    // Don't show any loading states while splash screen is active
    if (!isSplashComplete || authLoading) {
        return isSplashComplete ? <DashboardSkeleton /> : null;
    }

    if (!user) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Sign in to see personalized notes
                </h2>
                <p className="text-gray-600">
                    Get notes tailored to your major, semester, and interests
                </p>
            </div>
        );
    }

    return (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Your Notes Feed
                </h1>
                <p className="text-gray-600">
                    Discover notes that matter to you, powered by smart recommendations
                </p>
            </div>
            
            <PersonalizedFeed />
        </div>
    );
};