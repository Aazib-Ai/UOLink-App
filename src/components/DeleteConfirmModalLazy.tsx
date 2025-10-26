'use client'

import dynamic from 'next/dynamic'
import DeleteConfirmModalSkeleton from '@/components/skeletons/DeleteConfirmModalSkeleton'

// Define the props interface for the DeleteConfirmModal
interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  noteTitle: string
  noteSubject: string
  isDeleting?: boolean
}

// Lazy load the DeleteConfirmModal with loading fallback
const DeleteConfirmModalDynamic = dynamic(
  () => import('./DeleteConfirmModal'),
  {
    loading: () => <DeleteConfirmModalSkeleton />,
    ssr: false, // Modal requires client-side interaction
  }
)

export function DeleteConfirmModalLazy(props: DeleteConfirmModalProps) {
  // Only render the component when it's actually open to prevent loading skeletons from showing
  if (!props.isOpen) {
    return null
  }
  
  return <DeleteConfirmModalDynamic {...props} />
}

export default DeleteConfirmModalLazy