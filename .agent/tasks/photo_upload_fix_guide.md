# Photo Upload Fix Summary

## Problem Identified

The photo upload feature in the Complete Profile page (`src/components/CompleteProfile.tsx`) has several issues that cause errors during account creation:

### Root Causes:

1. **Race Condition**: The `handleImageUpload` function (lines 133-162) reads the file with FileReader and uploads to R2 storage simultaneously, causing timing conflicts.

2. **Poor Error Handling**:
   - Errors during upload don't clear the preview image
   - File input isn't reset when errors occur
   - Previous errors aren't cleared before new upload attempts
   - Users see a local preview even if the upload fails

3. **No Loading State**: Users have no visual indication that their photo is being uploaded, leading to:
   - Confusion about whether the upload is working
   - Multiple upload attempts
   - Frustration during slow network conditions

4. **Incomplete Validation**: Only file size is validated client-side, not file type

## Required Fixes

### 1. Add Upload Loading State (Line 62)
Add a new state variable after `isSubmitting`:
```typescript
const [isUploadingImage, setIsUploadingImage] = useState(false)
```

### 2. Improve handleImageUpload Function (Lines 133-162)
Replace the entire function with:
```typescript
const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Clear any previous errors
  setError(null)

  // Validate file size
  if (file.size > 5 * 1024 * 1024) {
    setError('Image size should be less than 5MB')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    return
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    setError('Please select a valid image file')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    return
  }

  // Show loading state
  setIsUploadingImage(true)

  // Create a temporary preview while uploading
  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    setPreviewImage(result)
  }
  reader.readAsDataURL(file)

  // Upload to storage via server API
  try {
    const uploadRes = await uploadProfilePicture(file)
    
    if ('error' in uploadRes) {
      throw new Error(uploadRes.error)
    }
    
    const { fileUrl, storageKey } = uploadRes.data
    
    // Update with the actual uploaded image URL
    setPreviewImage(fileUrl)
    setProfileData(prev => ({ 
      ...prev, 
      profilePicture: fileUrl, 
      profilePictureStorageKey: storageKey 
    }))
    
  } catch (err) {
    console.error('Image upload error:', err)
    
    // Clear the preview on error
    setPreviewImage(null)
    setProfileData(prev => ({ 
      ...prev, 
      profilePicture: null, 
      profilePictureStorageKey: null 
    }))
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    // Show error message
    setError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.')
  } finally {
    setIsUploadingImage(false)
  }
}
```

### 3. Update UI to Show Loading State (Lines 338-390)
Update the profile picture upload section:

- Change the className to include loading state:
```typescript
className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-amber-50 border-2 border-dashed border-amber-300 flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-200/70 ${
  isUploadingImage 
    ? 'cursor-not-allowed opacity-60' 
    : 'cursor-pointer hover:bg-amber-100'
}`}
```

- Update onClick to check loading state:
```typescript
onClick={() => !isUploadingImage && fileInputRef.current?.click()}
```

- Update onKeyDown to check loading state:
```typescript
onKeyDown={(event) => {
  if (!isUploadingImage && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    fileInputRef.current?.click()
  }
}}
```

- Update tabIndex:
```typescript
tabIndex={isUploadingImage ? -1 : 0}
```

- Add aria-disabled:
```typescript
aria-disabled={isUploadingImage}
```

- Add loading spinner before previewImage check:
```typescript
{isUploadingImage ? (
  <div className="text-center">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-600 border-t-transparent mx-auto mb-2"></div>
    <span className="text-xs text-amber-600 font-medium">Uploading...</span>
  </div>
) : previewImage ? (
  // existing preview code
) : (
  // existing add photo code
)}
```

- Hide remove button during upload:
```typescript
{previewImage && !isUploadingImage && (
  // existing remove button code
)}
```

- Disable file input during upload:
```typescript
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
  disabled={isUploadingImage}
  className="hidden"
  aria-describedby="profile-picture-help"
/>
```

- Update help text:
```typescript
<p id="profile-picture-help" className="text-xs text-gray-500 mt-2">
  {isUploadingImage ? 'Uploading your photo...' : 'Click to upload - JPG or PNG up to 5MB'}
</p>
```

## Benefits of These Fixes

1. ✅ Users see clear feedback during upload
2. ✅ Errors are properly handled and communicated
3. ✅ File input is reset on errors
4. ✅ Preview only shows after successful upload
5. ✅ Better validation prevents invalid files
6. ✅ Loading state prevents multiple simultaneous uploads
7. ✅ Improved accessibility with aria attributes

## Testing Checklist

- [ ] Upload valid JPG image under 5MB
- [ ] Upload valid PNG image under 5MB
- [ ] Try to upload file over 5MB (should show error)
- [ ] Try to upload non-image file (should show error)
- [ ] Test on slow network (should show loading spinner)
- [ ] Verify error recovery works correctly
- [ ] Test removing uploaded images
- [ ] Verify successful uploads show correct image

