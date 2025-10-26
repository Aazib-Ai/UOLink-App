# Dashboard Component Refactor

The original `Dashboard.tsx` component (over 1800 lines) has been refactored into smaller, more manageable components for easier maintenance and feature development.

## File Structure

### Main Component
- **`DashboardRefactored.tsx`** - Main orchestrator component that combines all smaller pieces
- **`Dashboard.tsx`** - Original file, now just exports the refactored version

### Constants and Utilities
- **`constants.ts`** - All constants, utility functions, and helper methods
  - PDF URL detection
  - Vibe badge calculations
  - Trending score computation
  - Image resolution logic
  - Timestamp utilities

### Custom Hooks
- **`useDashboardState.ts`** - Main state management hook
  - Notes data and loading states
  - Filter states and options
  - Search and pagination logic
  - Admin state management

- **`useSavedNotes.ts`** - Saved notes functionality
  - Fetch saved notes from Firebase
  - Save/unsave notes
  - Real-time UI updates

- **`useProfileData.ts`** - Profile management
  - Fetch contributor profiles
  - Profile pictures caching
  - Aura tier information
  - Profile slug generation

### UI Components
- **`DashboardFilters.tsx`** - Complete filter panel
  - Mobile collapsible filters
  - Desktop filter layout
  - All filter dropdowns (subject, teacher, semester, etc.)
  - Reset functionality

- **`DashboardSearch.tsx`** - Search bar component
  - Input with search icon
  - Debounced search integration

- **`DashboardSort.tsx`** - Sort options component
  - Trending/Top/Latest sort modes
  - Active state styling

- **`NoteCard.tsx`** - Individual note display
  - Responsive layouts (mobile/tablet/desktop)
  - Action buttons (view, vote, save, report, delete)
  - Profile information display
  - PDF thumbnail integration

## Benefits of This Structure

### 1. **Separation of Concerns**
- State management is isolated in hooks
- UI components are focused on presentation
- Business logic is in utility functions

### 2. **Reusability**
- Hooks can be reused in other components
- UI components can be independently tested
- Utility functions are available throughout the app

### 3. **Maintainability**
- Each file has a single responsibility
- Easier to locate and fix bugs
- Clear dependencies between components

### 4. **Feature Development**
- Easy to add new filter types
- Simple to modify note card layout
- Straightforward to add new sorting options

### 5. **Testing**
- Each hook can be unit tested
- Components can be tested in isolation
- Utility functions are easily testable

## How to Add New Features

### Adding a New Filter
1. Update filter state in `useDashboardState.ts`
2. Add filter UI in `DashboardFilters.tsx`
3. Update filter application logic in the hook

### Modifying Note Card Layout
1. Edit the appropriate layout function in `NoteCard.tsx`
2. Mobile, tablet, and desktop layouts are separate
3. No need to touch other components

### Adding New Sorting Options
1. Add option to `constants.ts`
2. Update sorting logic in `useDashboardState.ts`
3. UI automatically updates via `DashboardSort.tsx`

### Adding New Actions to Notes
1. Add action to `NoteCard.tsx`
2. Add handler to main dashboard component
3. Update state management if needed

## Data Flow

1. **`DashboardRefactored`** orchestrates all pieces
2. **Hooks** manage state and side effects
3. **Components** render UI and call hook functions
4. **Constants** provide utilities and configuration
5. **Events** flow from components → hooks → state updates → re-renders

This architecture makes the codebase much more approachable for new developers and significantly easier to maintain and extend.