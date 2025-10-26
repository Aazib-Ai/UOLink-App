'use client'

import dynamic from 'next/dynamic'
import UploadModalSkeleton from '@/components/skeletons/UploadModalSkeleton'

// Define the props interface for the UploadModal
interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onScanRequest?: () => void
  scannedFile?: File | null
  onSuccess?: () => void
}

// Lazy load the UploadModal with loading fallback
const UploadModalDynamic = dynamic(
  () => import('./UploadModal'),
  {
    loading: () => <UploadModalSkeleton />,
    ssr: false, // Upload modal requires client-side file handling
  }
)

export function UploadModalLazy(props: UploadModalProps) {
  // Only render the component when it's actually open to prevent loading skeletons from showing
  if (!props.isOpen) {
    return null
  }
  
  return <UploadModalDynamic {...props} />
}

export default UploadModalLazy