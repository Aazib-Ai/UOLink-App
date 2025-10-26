'use client'

import dynamic from 'next/dynamic'
import ScannerSkeleton from '@/components/skeletons/ScannerSkeleton'
import type { ScannerModalProps } from './types'

// Lazy load the ScannerModal with loading fallback
const ScannerModalDynamic = dynamic(
  () => import('./ScannerModal').then(mod => ({ default: mod.ScannerModal })),
  {
    loading: () => <ScannerSkeleton />,
    ssr: false, // Scanner requires camera access, disable SSR
  }
)

export function ScannerModalLazy(props: ScannerModalProps) {
  // Only render the component when it's actually open to prevent loading skeletons from showing
  if (!props.isOpen) {
    return null
  }
  
  return <ScannerModalDynamic {...props} />
}

export default ScannerModalLazy