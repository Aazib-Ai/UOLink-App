'use client'

import dynamic from 'next/dynamic'
import PDFViewerSkeleton from '@/components/skeletons/PDFViewerSkeleton'

// Define the props interface for the PDFViewer
interface PDFViewerProps {
  url: string
  title?: string
}

// Lazy load the PDFViewer with loading fallback
const PDFViewerDynamic = dynamic(
  () => import('./PDFViewer'),
  {
    loading: () => <PDFViewerSkeleton />,
    ssr: false, // PDF viewer requires client-side iframe handling
  }
)

export function PDFViewerLazy(props: PDFViewerProps) {
  // PDFViewer should always render since it's used in note pages where it's always visible
  return <PDFViewerDynamic {...props} />
}

export default PDFViewerLazy