let pdfjsLibPromise: Promise<any> | null = null

export const loadPdfJs = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')

      if (typeof window !== 'undefined') {
        // @ts-ignore - PDF.js worker module doesn't have proper types
        const workerSrcModule = await import('pdfjs-dist/legacy/build/pdf.worker')
        const workerSrc = (workerSrcModule as any).default || workerSrcModule

        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
        }
      }

      return pdfjsLib
    })()
  }

  return pdfjsLibPromise
}
