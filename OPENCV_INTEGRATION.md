# OpenCV Document Detection Integration

## Files Created

1. **opencvUtils.ts** - OpenCV document detection utility
   - Location: `src/components/scanner/opencvUtils.ts`
   - Functions:
     - `loadOpenCV()` - Loads OpenCV.js library
     - `detectDocument(dataUrl)` - Detects document edges and applies perspective correction

## Integration Steps

### 1. Update ScannerModal.tsx

Add imports at the top:
```typescript
import { detectDocument, loadOpenCV } from './opencvUtils'
```

Add state variable after other useState declarations:
```typescript
const [isProcessingDocument, setIsProcessingDocument] = useState(false)
```

### 2. Preload OpenCV when modal opens

Find the useEffect that starts the camera (around line 310) and update it:
```typescript
useEffect(() => {
  if (isOpen) {
    loadOpenCV().catch(err => console.warn('OpenCV preload failed:', err))
    startCamera()
  } else {
    stopCamera()
    resetState()
  }

  return () => {
    stopCamera()
  }
}, [isOpen, startCamera, stopCamera, resetState])
```

### 3. Update handleCaptureKeep function

Replace the existing `handleCaptureKeep` function (around line 430) with:
```typescript
const handleCaptureKeep = useCallback(async () => {
  if (!pendingCapture) return

  setIsProcessingDocument(true)
  try {
    const processedDataUrl = await detectDocument(pendingCapture)
    
    setPages((previous) => {
      if (previous.length >= MAX_CAPTURED_PAGES) {
        return previous
      }

      const newPage: ScannerPage = {
        id: createPageId(),
        originalDataUrl: pendingCapture,
        processedDataUrl: processedDataUrl,
        edits: {
          crop: DEFAULT_CROP,
          zoom: DEFAULT_ZOOM,
          cropAreaPixels: null,
          filter: 'original',
        },
      }

      return [...previous, newPage]
    })
  } catch (error) {
    console.error('Document detection failed:', error)
    setPages((previous) => {
      if (previous.length >= MAX_CAPTURED_PAGES) {
        return previous
      }

      const newPage: ScannerPage = {
        id: createPageId(),
        originalDataUrl: pendingCapture,
        processedDataUrl: pendingCapture,
        edits: {
          crop: DEFAULT_CROP,
          zoom: DEFAULT_ZOOM,
          cropAreaPixels: null,
          filter: 'original',
        },
      }

      return [...previous, newPage]
    })
  } finally {
    setIsProcessingDocument(false)
    setPendingCapture(null)
  }
}, [pendingCapture])
```

### 4. Update Save scan button

Find the "Save scan" button in the pending capture modal (around line 750) and replace it with:
```typescript
<button
  type="button"
  onClick={handleCaptureKeep}
  disabled={isProcessingDocument}
  className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332] disabled:bg-gray-400 disabled:cursor-not-allowed"
>
  {isProcessingDocument ? (
    <>
      <Loader2 className="h-5 w-5 animate-spin" />
      Processing...
    </>
  ) : (
    <>
      <Check className="h-5 w-5" />
      Save scan
    </>
  )}
</button>
```

## How It Works

1. **User captures image** - Camera captures the photo
2. **User clicks "Save scan"** - Triggers `handleCaptureKeep`
3. **OpenCV processes image**:
   - Converts to grayscale
   - Applies Gaussian blur
   - Detects edges with Canny
   - Finds largest 4-sided contour (document)
   - Applies perspective transform to flatten
4. **Result saved** - Flattened document stored as processed image
5. **User can edit** - Manual crop/filter still available

## Features

✅ Automatic document edge detection
✅ Perspective correction (dewarp)
✅ Fallback to original if detection fails
✅ Loading state during processing
✅ Works with existing crop/filter workflow

## Testing

Test on mobile with:
- Documents at angles
- Documents with clear edges
- Poor lighting conditions
- Multiple page types

The system will automatically flatten skewed documents!
