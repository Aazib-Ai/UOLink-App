# Scanner Modal Architecture

This document describes the refactored scanner modal system that follows a modular, finite-state machine architecture with clear separation of concerns.

## Architecture Overview

The scanner system is built around:
- **Finite State Machine**: Centralized state management with a reducer
- **Modular Hooks**: Each hook owns its specific slice of functionality
- **Presentational Components**: Step components that receive state and callbacks
- **Context API**: Clean interface for parent components

## Directory Structure

```
src/components/scanner/
├── components/           # Presentational step components
│   ├── ScannerCaptureStep.tsx
│   ├── ScannerReviewStep.tsx
│   ├── ScannerEditStep.tsx
│   ├── ScannerToolbar.tsx
│   └── index.ts
├── contexts/            # State management
│   ├── ScannerContext.tsx
│   └── index.ts
├── hooks/               # Modular functionality hooks
│   ├── useCameraSession.ts
│   ├── useLiveDetection.ts
│   ├── usePageProcessing.ts
│   ├── usePdfAssembler.ts
│   └── index.ts
├── types/               # TypeScript definitions
│   └── index.ts
├── ScannerModal.tsx     # Main orchestrator component
├── imageUtils.ts        # Image processing utilities (existing)
├── opencvUtils.ts       # OpenCV utilities (existing)
├── index.ts             # Public exports
└── README.md            # This documentation
```

## Core Components

### 1. Finite State Machine (`ScannerContext.tsx`)

**State Management**: Uses `useReducer` for predictable state transitions
**Actions**: 20+ typed actions for all state mutations
**Initial State**: Comprehensive default values for all scanner properties

```typescript
type ScannerStep = 'capture' | 'review' | 'edit'
type ScannerAction =
  | { type: 'SET_STEP'; payload: ScannerStep }
  | { type: 'ADD_PAGE'; payload: ScannerPage }
  | { type: 'SET_CAMERA_ERROR'; payload: string | null }
  // ... 17+ more actions
```

### 2. Modular Hooks

#### `useCameraSession`
- **Purpose**: Camera lifecycle, video stream management, torch control
- **Returns**: Video refs, camera controls, display metrics
- **Key Features**: Auto-rotation handling, device compatibility, torch API

#### `useLiveDetection`
- **Purpose**: Real-time document detection using OpenCV
- **Returns**: Canvas ref, detection state, control functions
- **Key Features**: Performance optimized, automatic cleanup, confidence scoring

#### `usePageProcessing`
- **Purpose**: Image processing and page manipulation
- **Returns**: Processing functions, state, options
- **Key Features**: Advanced document detection, filter application, async processing

#### `usePdfAssembler`
- **Purpose**: PDF generation from scanned pages
- **Returns**: PDF generation function, loading state
- **Key Features**: jsPDF integration, A4 formatting, image optimization

### 3. Presentational Components

#### `ScannerCaptureStep`
- **Purpose**: Camera capture interface with live detection
- **Props**: State, refs, callbacks for all capture actions
- **Features**: Native camera UI, torch toggle, processing indicators

#### `ScannerReviewStep`
- **Purpose**: Page review, reordering, and export interface
- **Props**: State, callbacks for page management
- **Features**: Drag-and-drop reordering, batch operations, PDF generation

#### `ScannerEditStep`
- **Purpose**: Individual page editing interface
- **Props**: State, editing controls, filter options
- **Features**: Cropper integration, real-time filters, zoom controls

#### `ScannerToolbar`
- **Purpose**: Top navigation and controls for capture mode
- **Props**: State, toggle callbacks
- **Features**: Settings toggles, page counter, navigation

## Usage Example

```typescript
import { ScannerModal } from '@/components/scanner'

function MyComponent() {
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const handleScannerComplete = (file: File) => {
    // Handle generated PDF
    console.log('PDF generated:', file.name)
    setIsScannerOpen(false)
  }

  const handleScannerClose = () => {
    setIsScannerOpen(false)
  }

  return (
    <ScannerModal
      isOpen={isScannerOpen}
      onClose={handleScannerClose}
      onComplete={handleScannerComplete}
    />
  )
}
```

## Key Improvements

### 1. Separation of Concerns
- **Each hook owns its slice**: Camera, detection, processing, PDF generation
- **Components are presentational**: Receive state and callbacks as props
- **State is centralized**: Single source of truth through context

### 2. Type Safety
- **Comprehensive TypeScript**: All interfaces and actions typed
- **No implicit any**: Strict typing throughout the system
- **Clear contracts**: Props and return types explicitly defined

### 3. Maintainability
- **Modular architecture**: Easy to test and modify individual pieces
- **Clear data flow**: State changes flow through predictable actions
- **Reusable hooks**: Can be used independently in other components

### 4. Performance
- **Optimized rendering**: State updates are batched and targeted
- **Memory management**: Proper cleanup in all hooks
- **Lazy loading**: OpenCV and other heavy resources loaded on demand

### 5. User Experience
- **Smooth transitions**: Animation and loading states
- **Error handling**: Graceful fallbacks for camera/device issues
- **Responsive design**: Works on mobile and desktop

## State Flow

1. **Initialization**: ScannerModal provides context and mounts
2. **Camera Setup**: useCameraSession initializes video stream
3. **Live Detection**: useLiveDetection starts document detection
4. **Capture**: User triggers capture, image is processed by usePageProcessing
5. **Review**: Pages displayed in ScannerReviewStep with reordering
6. **Edit**: Individual pages edited in ScannerEditStep
7. **Export**: usePdfAssembler generates final PDF

## Migration Notes

The new system is a drop-in replacement for the original ScannerModal:

```typescript
// Old usage (still works)
<ScannerModal isOpen={isOpen} onClose={onClose} onComplete={onComplete} />

// New usage (same API)
<ScannerModal isOpen={isOpen} onClose={onClose} onComplete={onComplete} />
```

**Internal changes only** - the public interface remains identical while the internals are completely refactored for better maintainability and extensibility.

## Testing

Each hook can be tested independently:

```typescript
// Example test for useCameraSession
import { renderHook } from '@testing-library/react'
import { useCameraSession } from '../hooks/useCameraSession'

test('should initialize camera session', () => {
  const { result } = renderHook(() => useCameraSession())
  expect(result.current.videoRef).toBeDefined()
  expect(result.current.startCamera).toBeDefined()
})
```

## Future Enhancements

The modular architecture makes these enhancements straightforward:
- **Multiple file formats**: Extend usePdfAssembler
- **Cloud processing**: Modify usePageProcessing
- **Advanced filters**: Add to ScannerEditStep
- **Batch operations**: Extend ScannerReviewStep
- **Analytics**: Add to context and hooks
- **Offline support**: Enhance storage in hooks