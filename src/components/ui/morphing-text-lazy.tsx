'use client'

import dynamic from 'next/dynamic'
import MorphingTextSkeleton from '@/components/skeletons/MorphingTextSkeleton'

// Define the props interface for the MorphingText
interface MorphingTextProps {
  texts: string[]
  className?: string
}

// Lazy load the MorphingText with loading fallback
const MorphingTextDynamic = dynamic(
  () => import('./morphing-text').then(mod => ({ default: mod.MorphingText })),
  {
    loading: () => <MorphingTextSkeleton />,
    ssr: false, // Animation component requires client-side
  }
)

export function MorphingTextLazy(props: MorphingTextProps) {
  // MorphingText should always render since it's used in visible dashboard sections
  return <MorphingTextDynamic {...props} />
}

export default MorphingTextLazy