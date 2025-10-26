import PDFThumbnail from '../../PDFThumbnail'
import { resolvePreviewImage, isPDFUrl } from '../constants'
import { Note, Variant } from './types'
import { resolveUploadDescriptorByUrl } from '@/constants/uploadFileTypes'
import { FileText } from 'lucide-react'

interface PreviewPaneProps {
  note: Note
  handleViewNote: (note: Note) => void
  variant: Variant
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  note,
  handleViewNote,
  variant
}) => {
  const renderDocumentPlaceholder = (singularLabel: string, lowercaseLabel: string) => {
    const dimensionClasses =
      variant === 'mobile'
        ? 'w-full h-32'
        : variant === 'tablet'
        ? 'w-40 h-32'
        : 'h-48 w-40'
    const borderClass = variant === 'desktop' ? 'border-2' : 'border'

    return (
      <div
        onClick={() => handleViewNote(note)}
        className={`${dimensionClasses} ${borderClass} cursor-pointer rounded-lg border-gray-300 bg-[#f7fbe9] p-3 flex flex-col items-center justify-center text-center text-[#5f7050] transition hover:border-[#90c639]`}
      >
        <FileText className={`${variant === 'mobile' ? 'h-5 w-5' : 'h-6 w-6'} text-[#7a8f5d]`} />
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
          {singularLabel}
        </span>
        <span className="mt-1 text-[10px] text-[#7a8f5d] sm:text-[11px]">
          Tap to open the {lowercaseLabel}
        </span>
      </div>
    )
  }

  const renderPreviewContent = () => {
    const fileUrl = note.fileUrl || ''
    const descriptor = resolveUploadDescriptorByUrl(fileUrl)
    const isDocumentFile = descriptor && descriptor.extension !== 'pdf'
    const singularLabel = descriptor?.label
      ? descriptor.label.toLowerCase().endsWith('s')
        ? descriptor.label.slice(0, -1)
        : descriptor.label
      : 'Document'
    const lowercaseLabel = singularLabel.toLowerCase()

    if (isPDFUrl(fileUrl)) {
      return (
        <PDFThumbnail
          url={fileUrl}
          width={
            variant === 'mobile' ? 280 :
            variant === 'tablet' ? 200 : 160
          }
          height={
            variant === 'mobile' ? 140 :
            variant === 'tablet' ? 160 : 192
          }
          className={
            variant === 'mobile'
              ? 'w-full rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity'
              : variant === 'tablet'
              ? 'rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity'
              : 'border-2 border-gray-300'
          }
          onClick={() => handleViewNote(note)}
        />
      )
    }

    if (isDocumentFile) {
      return renderDocumentPlaceholder(singularLabel, lowercaseLabel)
    }

    return (
      <img
        onClick={() => handleViewNote(note)}
        src={resolvePreviewImage(note) || "/placeholder.svg"}
        alt="PDF Preview"
        className={
          variant === 'mobile'
            ? 'w-full h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity'
            : variant === 'tablet'
            ? 'w-40 h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity'
            : 'h-48 w-40 cursor-pointer rounded-lg border-2 border-gray-300 object-cover transition-all duration-300 hover:brightness-90'
        }
      />
    )
  }

  if (variant === 'mobile') {
    return (
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        {renderPreviewContent()}
      </div>
    )
  }

  if (variant === 'tablet') {
    return (
      <div className="flex-shrink-0">
        {renderPreviewContent()}
      </div>
    )
  }

  // Desktop variant
  return (
    <div className="flex flex-col items-center justify-between ml-6">
      {renderPreviewContent()}
    </div>
  )
}
