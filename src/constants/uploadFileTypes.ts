export interface UploadFileDescriptor {
  extension: string
  label: string
  mimeTypes: readonly string[]
}

export const SUPPORTED_UPLOAD_FILE_DESCRIPTORS: readonly UploadFileDescriptor[] = [
  {
    extension: 'pdf',
    label: 'PDF',
    mimeTypes: ['application/pdf'],
  },
  {
    extension: 'ppt',
    label: 'PowerPoint',
    mimeTypes: ['application/vnd.ms-powerpoint'],
  },
  {
    extension: 'pptx',
    label: 'PowerPoint',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  },
  {
    extension: 'ppsx',
    label: 'PowerPoint',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
  },
  {
    extension: 'doc',
    label: 'Word documents',
    mimeTypes: ['application/msword'],
  },
  {
    extension: 'docx',
    label: 'Word documents',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
] as const

const descriptorByMime = new Map<string, UploadFileDescriptor>()
const descriptorByExtension = new Map<string, UploadFileDescriptor>()

for (const descriptor of SUPPORTED_UPLOAD_FILE_DESCRIPTORS) {
  descriptorByExtension.set(descriptor.extension, descriptor)
  for (const mimeType of descriptor.mimeTypes) {
    descriptorByMime.set(mimeType, descriptor)
  }
}

export const SUPPORTED_UPLOAD_ACCEPT_ATTRIBUTE = SUPPORTED_UPLOAD_FILE_DESCRIPTORS.map(
  ({ extension }) => `.${extension}`
).join(',')

export const SUPPORTED_UPLOAD_EXTENSION_LIST = Array.from(
  new Set(SUPPORTED_UPLOAD_FILE_DESCRIPTORS.map(({ extension }) => `.${extension}`))
)

export const resolveUploadDescriptorByMime = (mimeType: string) =>
  descriptorByMime.get(mimeType.toLowerCase())

export const resolveUploadDescriptorByExtension = (extension: string) =>
  descriptorByExtension.get(extension.toLowerCase())

export const extractExtensionFromUrl = (value: string) => {
  if (!value) {
    return ''
  }

  const trimmed = value.trim()

  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname.toLowerCase()
    const match = pathname.match(/\.([a-z0-9]+)$/)
    if (match) {
      return match[1]
    }
  } catch {
    // Ignore URL parsing errors and fall back to manual checks
  }

  const withoutQuery = trimmed.split('?')[0].split('#')[0].toLowerCase()
  const match = withoutQuery.match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

export const resolveUploadDescriptorByUrl = (url: string) => {
  const extension = extractExtensionFromUrl(url)
  if (!extension) {
    return undefined
  }
  return resolveUploadDescriptorByExtension(extension)
}

export const getSupportedFileTypeSummary = () => {
  const seen = new Set<string>()
  const uniqueLabels: string[] = []

  for (const { label } of SUPPORTED_UPLOAD_FILE_DESCRIPTORS) {
    const key = label.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      uniqueLabels.push(label)
    }
  }

  if (uniqueLabels.length === 0) {
    return ''
  }

  if (uniqueLabels.length === 1) {
    return uniqueLabels[0]
  }

  if (uniqueLabels.length === 2) {
    return `${uniqueLabels[0]} and ${uniqueLabels[1]}`
  }

  return `${uniqueLabels.slice(0, -1).join(', ')} and ${uniqueLabels.at(-1)}`
}

export const SUPPORTED_UPLOAD_EXTENSIONS = new Set(
  SUPPORTED_UPLOAD_FILE_DESCRIPTORS.map(({ extension }) => extension.toLowerCase())
)

export const SUPPORTED_UPLOAD_MIME_TYPES = new Set(
  SUPPORTED_UPLOAD_FILE_DESCRIPTORS.flatMap(({ mimeTypes }) => mimeTypes.map((mime) => mime.toLowerCase()))
)
