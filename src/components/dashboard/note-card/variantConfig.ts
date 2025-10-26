import { Variant, VariantStyles } from './types'

export const getVariantStyles = (variant: Variant): VariantStyles => {
  switch (variant) {
    case 'mobile':
      return {
        header: {
          titleSize: 'text-lg font-bold',
          layout: 'vertical'
        },
        metadata: {
          gap: 'gap-1.5',
          chipSize: 'text-xs px-2 py-1'
        },
        layout: {
          direction: 'column',
          previewPosition: 'inline'
        }
      }

    case 'tablet':
      return {
        header: {
          titleSize: 'text-lg font-bold',
          layout: 'vertical'
        },
        metadata: {
          gap: 'gap-1.5',
          chipSize: 'text-xs px-2 py-1'
        },
        layout: {
          direction: 'row',
          previewPosition: 'side'
        }
      }

    case 'desktop':
      return {
        header: {
          titleSize: 'text-xl font-bold',
          layout: 'horizontal'
        },
        metadata: {
          gap: 'gap-2',
          chipSize: ''
        },
        layout: {
          direction: 'column',
          previewPosition: 'side'
        }
      }

    default:
      throw new Error(`Unknown variant: ${variant}`)
  }
}

export const getChipText = (variant: Variant, note: any) => {
  const baseText = {
    semester: note.semester || 'N/A',
    section: note.section || 'TBD',
    material: note.materialDisplay || 'Not specified'
  }

  if (variant === 'desktop') {
    return {
      semester: `Semester ${baseText.semester}`,
      section: `Section ${baseText.section}`,
      material: baseText.material
    }
  }

  return {
    semester: `Sem ${baseText.semester}`,
    section: `Sec ${baseText.section}`,
    material: baseText.material
  }
}

export const getDateVariant = (variant: Variant) => {
  return variant === 'desktop' ? 'en-GB' : 'en-GB'
}