import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Structural types derived from the DYNAMICALLY-imported pdf.js module — there is
// no static `import ... from 'pdfjs-dist'` anywhere in this file, so the ~1MB
// library only loads once a PDF preview is actually requested (§9). `typeof
// import(...)` is a compile-time-only type query: it is fully erased and adds
// nothing to the runtime bundle.
type PdfjsModule = typeof import('pdfjs-dist')
// `getDocument()` returns a loading task synchronously; ONLY the task (not the
// resolved document proxy) exposes `.destroy()` — the proxy only has `.cleanup()`.
type PdfLoadingTask = ReturnType<PdfjsModule['getDocument']>
type PdfDocument = Awaited<PdfLoadingTask['promise']>
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>
type PdfViewport = ReturnType<PdfPage['getViewport']>

// Fallback canvas width used before the container has a measurable layout.
const FALLBACK_WIDTH = 760

interface PdfPreviewProps {
  url: string
  // Bubbles up so the parent can fall back to the existing download link —
  // this component never renders a blank frame on failure.
  onError: () => void
}

/**
 * PdfPreview — renders every page of a PDF into its own <canvas> using pdf.js,
 * entirely client-side (no iframe, no dangerouslySetInnerHTML). This replaces
 * the unsandboxed <iframe> that used to preview tenant-uploaded PDFs (AUDIT-3):
 * a canvas render we fully control can live inside a sandboxed dialog safely.
 */
export default function PdfPreview({ url, onError }: PdfPreviewProps) {
  const { t } = useTranslation('candidates')
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const docRef = useRef<PdfDocument | null>(null)
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null)
  // `numPages === null` is the "still loading" state; once known, the canvas
  // grid mounts and pages paint in progressively as pdf.js renders them.
  const [numPages, setNumPages] = useState<number | null>(null)

  // Step 1: lazy-load pdf.js and open the document (only when a PDF preview is shown).
  useEffect(() => {
    let cancelled = false
    setNumPages(null)
    docRef.current = null
    loadingTaskRef.current = null

    const open = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        // Worker is bundled same-origin by Vite (new URL + import.meta.url) —
        // no external CDN, no inline eval (§7).
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href
        const loadingTask = pdfjsLib.getDocument({ url })
        loadingTaskRef.current = loadingTask
        const doc = await loadingTask.promise
        if (cancelled) { loadingTask.destroy(); return }
        if (doc.numPages < 1) throw new Error('Empty PDF (0 pages)')
        docRef.current = doc
        setNumPages(doc.numPages)
      } catch {
        if (!cancelled) onError()
      }
    }
    open()

    return () => {
      cancelled = true
      loadingTaskRef.current?.destroy?.()
      loadingTaskRef.current = null
      docRef.current = null
    }
  }, [url, onError])

  // Step 2: once the canvas grid for `numPages` is mounted, render each page into it.
  useEffect(() => {
    const doc = docRef.current
    if (!doc || !numPages) return
    let cancelled = false

    const renderAll = async () => {
      try {
        const width = containerRef.current?.clientWidth || FALLBACK_WIDTH
        for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
          if (cancelled) return
          const page = await doc.getPage(pageNumber)
          const scale = width / page.getViewport({ scale: 1 }).width
          const viewport: PdfViewport = page.getViewport({ scale })
          const canvas = canvasRefs.current[pageNumber - 1]
          const ctx = canvas?.getContext('2d')
          if (!canvas || !ctx) continue
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvas, viewport }).promise
        }
      } catch {
        if (!cancelled) onError()
      }
    }
    renderAll()

    return () => { cancelled = true }
  }, [numPages, onError])

  // Loading state — spinner/text while pdf.js opens the document.
  if (numPages === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13 }}>
        {t('documents.loadingPreview')}
      </div>
    )
  }

  // Success state — one canvas per page, painted progressively as pdf.js renders them.
  return (
    <div ref={containerRef} style={{ padding: 16 }}>
      {Array.from({ length: numPages }, (_, i) => (
        <canvas
          key={i}
          ref={el => { canvasRefs.current[i] = el }}
          aria-label={t('documents.pdfPageLabel', { page: i + 1, total: numPages })}
          style={{ display: 'block', width: '100%', height: 'auto', margin: '0 auto 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
        />
      ))}
    </div>
  )
}
