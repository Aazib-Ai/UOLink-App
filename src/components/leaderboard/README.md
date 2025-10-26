# Leaderboard Feature

## Overview
The leaderboard displays the top 10 users ranked by their aura points, showing their profile information and contribution statistics.

## Components

### LeaderboardPage (`src/components/LeaderboardPage.tsx`)
Main leaderboard page component that displays:
- Top 25 users ranked by aura points
- User profile pictures with fallbacks
- Aura tier badges
- Contribution statistics (notes, upvotes, saves)
- Special highlighting for current user
- Rank icons for top 3 positions
- Refresh functionality

### useLeaderboard Hook (`src/hooks/useLeaderboard.ts`)
Custom hook that:
- Fetches top users from Firebase profiles collection
- Enhances user data with note statistics
- Provides loading, error, and refetch functionality
- Returns ranked leaderboard data

## Features

### Visual Elements
- **Rank Icons**: Trophy, Medal, Award for top 3, numbered badges for others
- **Profile Pictures**: With fallback to initials or generated avatars
- **Aura Tier Badges**: Styled according to user's aura tier
- **Current User Highlighting**: Special border and "You" badge
- **Responsive Design**: Mobile-friendly layout

### Statistics Displayed
- **Aura Points**: Primary ranking metric
- **Total Notes**: Number of notes uploaded
- **Total Upvotes**: Community approval count
- **Total Saves**: How often notes are bookmarked
- **Aura Tier**: Current tier based on aura points

### Navigation
- Added to main navbar (authenticated and non-authenticated)
- Accessible from Aura page
- Quick action link on dashboard
- Back button navigation

## Data Flow
1. `useLeaderboard` hook fetches profiles ordered by aura
2. For each profile, fetches associated notes for statistics
3. Combines data into enhanced leaderboard entries
4. Ranks users and provides to component
5. Component renders with appropriate styling and interactions

## Performance Considerations
- Limits to top 10 users to reduce load
- Caches results until manual refresh
- Optimized Firebase queries with proper indexing
- Lazy loading of note statistics

## Future Enhancements
- Pagination for more users
- Time-based leaderboards (weekly, monthly)
- Category-specific leaderboards
- Achievement badges
- Social sharing of rankings