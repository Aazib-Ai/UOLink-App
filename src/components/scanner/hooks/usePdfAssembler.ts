'use client'

import { useCallback, useMemo } from 'react'
import { useScanner } from '../contexts/ScannerContext'
import { processImage } from '../imageUtils'
import type { UsePdfAssemblerReturn, ScannerPage } from '../types'

export function usePdfAssembler(): UsePdfAssemblerReturn {
  const { state, dispatch } = useScanner()

  const handleGeneratePdf = useCallback(async (
    pages: ScannerPage[],
    onComplete: (file: File) => void,
    handleClose: () => void
  ) => {
    if (!pages.length) return

    dispatch({ type: 'SET_GENERATING_PDF', payload: true })
    try {
      const [{ jsPDF }, processedPages] = await Promise.all([
        import('jspdf'),
        Promise.all(
          pages.map(async (page) => {
            if (page.edits.filter === 'original' && !page.edits.cropAreaPixels) {
              return page.processedDataUrl || page.originalDataUrl
            }
            return processImage(page.originalDataUrl, {
              cropAreaPixels: page.edits.cropAreaPixels ?? undefined,
              filter: page.edits.filter,
            })
          })
        ),
      ])

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      processedPages.forEach((dataUrl, index) => {
        if (index > 0) {
          pdf.addPage()
        }

        const imageProps = pdf.getImageProperties(dataUrl)
        const ratio = Math.min(pageWidth / imageProps.width, pageHeight / imageProps.height)
        const renderWidth = imageProps.width * ratio
        const renderHeight = imageProps.height * ratio
        const offsetX = (pageWidth - renderWidth) / 2
        const offsetY = (pageHeight - renderHeight) / 2

        pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderWidth, renderHeight)
      })

      const blob = pdf.output('blob')
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const file = new File([blob], `UOLink-Scan-${timestamp}.pdf`, {
        type: 'application/pdf',
        lastModified: Date.now()
      })

      console.log('[usePdfAssembler] Generated PDF:', {
        name: file.name,
        size: file.size,
        type: file.type,
        pages: pages.length
      })

      onComplete(file)
      handleClose()
    } catch (error) {
      console.error('[usePdfAssembler] Failed to generate PDF', error)
      dispatch({
        type: 'SET_CAMERA_ERROR',
        payload: 'Unable to generate the PDF. Please try again.'
      })
    } finally {
      dispatch({ type: 'SET_GENERATING_PDF', payload: false })
    }
  }, [dispatch])

  return useMemo(() => ({
    isGeneratingPdf: state.isGeneratingPdf,
    handleGeneratePdf,
  }), [
    state.isGeneratingPdf,
    handleGeneratePdf,
  ])
}