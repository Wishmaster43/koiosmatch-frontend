import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useDocumentTypes, resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import PdfPreview from './PdfPreview'

const isImage = (name = '') => /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
const isPdf   = (name = '') => /\.pdf$/i.test(name)

interface PreviewDoc {
  objectUrl?: string
  url?: string
  download_url?: string
  type?: string
  name?: string
  file_name?: string
}

/**
 * DocPreviewModal — the ONE document-preview dialog, shared by every entity that
 * lists documents (candidates, applications' CvBlock, and — this task — the
 * customer DocumentsTab). MOVED (Danny 03-08, DOC-PREVIEW-1) from
 * pages/candidates/drawer/ to components/drawer/ — §2 forbids a `components/`
 * file importing an entity page's internals, so once the customer drawer needed
 * this too, it had to live in shared ground.
 *
 * BLOB-FETCH FIX (this task): the customer DocumentsTab's old "preview" button did
 * `window.open(download_url)` — a real browser NAVIGATION to a route the backend
 * answers with `Content-Disposition: attachment` (Storage::download), so the
 * browser downloaded the file instead of showing it (measured root cause, Danny:
 * "Preview van documenten is downloaden i.p.v. preview???"). This modal never
 * navigates: a PERSISTED doc's authenticated `url` is fetched here as a BLOB
 * (plain `fetch`, not the shared `api` axios client — `url` already carries the
 * client's own baseURL prefix, mirroring the existing `downloadFilesSequentially`
 * anchor-click convention for this exact URL contract) and rendered from the
 * resulting object URL. A blob fetch reads raw bytes over XHR/fetch, which the
 * browser never treats as a navigation, so the attachment header is irrelevant —
 * this is true for every entity's document contract (candidate/customer both emit
 * `{ url, download_url }`, see EntityDocumentController's shared payload()). A
 * locally queued (not-yet-uploaded) file already IS a local blob URL
 * (`doc.objectUrl`) and renders directly, no network round-trip needed.
 */
export default function DocPreviewModal({ doc, onClose, docTypeScope = 'candidate' }: {
  doc?: PreviewDoc | null
  onClose: () => void
  // The tenant document-type lookup scope for THIS doc's type/colour/icon (a
  // customer document's `type` is drawn from the 'customer'-scoped lookup, not
  // the candidate one) — defaults to 'candidate' so every pre-existing caller
  // (candidate Documents section, applications' CvBlock) is unchanged.
  docTypeScope?: string
}) {
  const { t } = useTranslation('candidates')
  // Document type label + colour + icon from the tenant lookup (seed fallback).
  // Read-only labels for the document — same scope as the list it opens from.
  const { labelOf: docTypeLabel, colorOf: docColor, iconOf: docTypeIcon } = useDocumentTypes(docTypeScope)
  // Hooks run unconditionally (before the `!doc` early return) — Rules of Hooks.
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  // A pdf.js render failure falls back to the same download link used for
  // unsupported file types — never a blank frame.
  const [pdfFailed, setPdfFailed] = useState(false)
  // The URL actually rendered: the local pending blob directly, or an object URL
  // built from the fetched bytes of a persisted doc. Null while that fetch is in
  // flight or hasn't started (no previewable type, or nothing to fetch at all).
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'error'>('idle')

  const name = doc?.name ?? doc?.file_name ?? ''
  const previewable = isImage(name) || isPdf(name)

  // Resolve the renderable URL. A pending (not-yet-uploaded) row's objectUrl is
  // already a local blob — use it directly. A persisted doc's `url` (authenticated
  // stream route) is fetched as a blob only when the file type is one we can
  // actually render — an unsupported type never triggers the network round-trip,
  // it goes straight to the "download to view" fallback below.
  useEffect(() => {
    setPdfFailed(false)
    setBlobUrl(null)
    setFetchState('idle')
    if (!doc) return
    if (doc.objectUrl) { setBlobUrl(doc.objectUrl); return }
    if (!doc.url || !previewable) return
    let cancelled = false
    let created: string | null = null
    setFetchState('loading')
    fetch(doc.url, { credentials: 'include' })
      .then(res => { if (!res.ok) throw new Error(`preview fetch failed: ${res.status}`); return res.blob() })
      .then(blob => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setBlobUrl(created)
        setFetchState('idle')
      })
      .catch(() => { if (!cancelled) setFetchState('error') })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the doc's own identity fields (url/objectUrl), not the whole object — a parent that re-creates the doc object on every render (e.g. a `.map(d => ({ ...d, _i }))` spread) must never re-trigger this fetch.
  }, [doc?.url, doc?.objectUrl, previewable])

  if (!doc) return null
  const typeLabel = docTypeLabel(doc.type)
  // The type's own curated icon (fallback FileText), matching the Documents list tile.
  const DocIcon = resolveDocTypeIcon(docTypeIcon(doc.type))
  const showPdfPreview = isPdf(name) && !pdfFailed && !!blobUrl
  // The honest escape hatch: a real download, never a silent one from a button
  // labelled preview. Prefers the blob already fetched (works even if the signed
  // download_url has since expired); falls back to the raw authenticated url.
  const downloadHref = blobUrl ?? doc.download_url ?? doc.url

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={name || t('documents.previewUnavailable')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', maxWidth: 800, width: '100%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: docColor(doc.type),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DocIcon size={13} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            {doc.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeLabel}</div>}
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', minHeight: 400 }}>
          {!doc.objectUrl && !doc.url ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('documents.noPreview')}
            </div>
          ) : fetchState === 'loading' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13 }}>
              {t('documents.loadingPreview')}
            </div>
          ) : isImage(name) && blobUrl ? (
            <img src={blobUrl} alt={name} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
          ) : showPdfPreview ? (
            // AUDIT-3 follow-up done: this used to be an unsandboxed <iframe> (Chrome
            // refuses its built-in PDF viewer inside ANY sandboxed frame — see git
            // history for the measured detail). pdf.js now renders every page into a
            // <canvas> we control client-side — no iframe, no dangerouslySetInnerHTML —
            // so the dialog no longer needs that unsandboxed escape hatch.
            <PdfPreview url={blobUrl as string} onError={() => setPdfFailed(true)} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13 }}>
              {t('documents.previewUnavailable')} {downloadHref && <a href={downloadHref} download={name} style={{ marginLeft: 6, color: 'var(--color-primary)' }}>{t('documents.download')}</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
