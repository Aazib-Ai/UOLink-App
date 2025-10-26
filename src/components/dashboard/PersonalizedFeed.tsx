'use client'

import React, { useState } from 'react';
import { usePersonalizedFeed } from '@/hooks/usePersonalizedFeed';
import { useDashboardState } from '@/hooks/useDashboardState';
import { User, TrendingUp, Filter, RefreshCw } from 'lucide-react';
import { DashboardFilters } from './DashboardFilters';

interface PersonalizedFeedProps {
    className?: string;
}

export const PersonalizedFeed: React.FC<PersonalizedFeedProps> = ({ className = '' }) => {
    const [feedMode, setFeedMode] = useState<'personalized' | 'general'>('personalized');
    const [showFilters, setShowFilters] = useState(false);
    
    // Dashboard state for filters and general feed
    const dashboardState = useDashboardState();
    
    // Personalized feed
    const personalizedFeed = usePersonalizedFeed({
        pageSize: 9,
        autoLoad: feedMode === 'personalized',
        filters: {
            semester: dashboardState.semesterFilter,
            subject: dashboardState.subjectFilter,
            teacher: dashboardState.teacherFilter,
            section: dashboardState.sectionFilter,
            materialType: dashboardState.materialTypeFilter,
            materialSequence: dashboardState.materialSequenceFilter,
            contributorName: dashboardState.nameFilter,
            contributorMajor: dashboardState.majorFilter,
        }
    });

    // Determine which feed to show
    const currentFeed = feedMode === 'personalized' ? personalizedFeed : dashboardState;
    const notes = feedMode === 'personalized' ? personalizedFeed.notes : dashboardState.displayedNotes;

    const handleModeSwitch = (mode: 'personalized' | 'general') => {
        setFeedMode(mode);
        if (mode === 'personalized') {
            personalizedFeed.refresh();
        }
    };

    const handleLoadMore = () => {
        if (feedMode === 'personalized') {
            personalizedFeed.loadMore();
        } else {
            dashboardState.loadMoreNotes();
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Feed Mode Toggle */}
            <div className="flex items-center justify-between bg-white/90 rounded-2xl border border-amber-100 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex bg-amber-50 rounded-xl p-1">
                        <button
                            onClick={() => handleModeSwitch('personalized')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                feedMode === 'personalized'
                                    ? 'bg-[#90c639] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                            disabled={!personalizedFeed.isPersonalized}
                        >
                            <User className="w-4 h-4" />
                            For You
                        </button>
                        <button
                            onClick={() => handleModeSwitch('general')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                feedMode === 'general'
                                    ? 'bg-[#90c639] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <TrendingUp className="w-4 h-4" />
                            Trending
                        </button>
                    </div>
                    
                    {feedMode === 'personalized' && !personalizedFeed.isPersonalized && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            Complete your profile for personalized feed
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (feedMode === 'personalized') {
                                personalizedFeed.refresh();
                            } else {
                                dashboardState.applyFilters();
                            }
                        }}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh feed"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {dashboardState.hasActiveFilters() && (
                            <span className="bg-[#90c639] text-white text-xs rounded-full px-2 py-0.5">
                                {dashboardState.getActiveFilterCount()}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <DashboardFilters
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                filterOptions={dashboardState.filterOptions}
                titleFilter={dashboardState.titleFilter}
                setTitleFilter={dashboardState.setTitleFilter}
                semesterFilter={dashboardState.semesterFilter}
                setSemesterFilter={dashboardState.setSemesterFilter}
                subjectFilter={dashboardState.subjectFilter}
                setSubjectFilter={dashboardState.setSubjectFilter}
                teacherFilter={dashboardState.teacherFilter}
                setTeacherFilter={dashboardState.setTeacherFilter}
                nameFilter={dashboardState.nameFilter}
                setNameFilter={dashboardState.setNameFilter}
                sectionFilter={dashboardState.sectionFilter}
                setSectionFilter={dashboardState.setSectionFilter}
                majorFilter={dashboardState.majorFilter}
                setMajorFilter={dashboardState.setMajorFilter}
                materialTypeFilter={dashboardState.materialTypeFilter}
                setMaterialTypeFilter={dashboardState.setMaterialTypeFilter}
                materialSequenceFilter={dashboardState.materialSequenceFilter}
                setMaterialSequenceFilter={dashboardState.setMaterialSequenceFilter}
                hasActiveFilters={dashboardState.hasActiveFilters}
                resetFilters={dashboardState.resetFilters}
            />

            {/* Feed Status */}
            {feedMode === 'personalized' && personalizedFeed.isPersonalized && (
                <div className="text-center py-2">
                    <p className="text-sm text-gray-600">
                        Showing notes tailored to your profile • {notes.length} notes
                    </p>
                </div>
            )}

            {/* Error State */}
            {currentFeed.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <p className="text-red-600 text-sm">{currentFeed.error}</p>
                    <button
                        onClick={() => currentFeed.setError?.(null)}
                        className="mt-2 text-red-500 hover:text-red-700 text-sm underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Loading State */}
            {currentFeed.loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Notes Grid */}
            {!currentFeed.loading && notes.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map((note) => (
                            <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900 line-clamp-2">
                                        {note.name || 'Untitled Note'}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {note.subject} • {note.semester}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        by {note.contributorName}
                                    </p>
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>↑ {note.upvoteCount || 0}</span>
                                            <span>💾 {note.saveCount || 0}</span>
                                        </div>
                                        <div className="text-xs text-[#90c639] font-medium">
                                            {note.credibilityScore || 0} pts
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {currentFeed.hasMore && (
                        <div className="text-center pt-4">
                            <button
                                onClick={handleLoadMore}
                                disabled={currentFeed.loadingMore}
                                className="px-6 py-3 bg-[#90c639] text-white rounded-xl font-medium hover:bg-[#7ab32d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {currentFeed.loadingMore ? 'Loading...' : 'Load More Notes'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Empty State */}
            {!currentFeed.loading && notes.length === 0 && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {feedMode === 'personalized' ? 'No personalized notes found' : 'No notes found'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                        {feedMode === 'personalized' 
                            ? 'Try adjusting your filters or switch to trending feed'
                            : 'Try adjusting your filters or check back later'
                        }
                    </p>
                    {dashboardState.hasActiveFilters() && (
                        <button
                            onClick={dashboardState.resetFilters}
                            className="text-[#90c639] hover:text-[#7ab32d] font-medium"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
