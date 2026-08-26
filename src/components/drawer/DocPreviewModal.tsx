// DocPreviewModal — the ONE document-preview dialog shared by every entity that
// lists documents. See the fuller doc comment below the type/helpers for why it
// fetches persisted documents as an authenticated blob instead of navigating.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentTypes, resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import FloatingPanel from '@/components/ui/FloatingPanel'
import PdfPreview from './PdfPreview'
import { getActiveTenantId } from '@/lib/api'

const isImage = (name = '') => /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
const isPdf   = (name = '') => /\.pdf$/i.test(name)

// The API's origin (protocol + host, no /api path) — relative document urls from
// the backend resolve against THIS, never against the frontend's own origin.
// A RELATIVE VITE_API_URL (same-origin proxy setups, and the test env) means the
// API genuinely lives on the frontend origin — fall back to it instead of throwing.
const API_ORIGIN = (() => {
  const raw = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
  try { return new URL(raw).origin } catch { return window.location.origin }
})()

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

  // Resolve the renderable URL(s). A pending (not-yet-uploaded) row's objectUrl is
  // already a local blob — used directly. A persisted doc is fetched as a blob only
  // when the file type is one we can actually render — an unsupported type never
  // triggers the network round-trip, it goes straight to the "download to view"
  // fallback below.
  //
  // PREVIEW-CORS-1 (Danny 08-08 "Preview niet beschikbaar", REPRODUCED in a real
  // browser against the real API): this list used to prefer the ABSOLUTE signed
  // `download_url` (http://koiosmatch-api.test/api/files/…). In the app's default
  // cookie mode the SPA runs on its own origin and reaches the API through the
  // same-origin /api proxy, so that absolute URL is a CROSS-ORIGIN fetch — Chrome
  // blocks it ("has been blocked by CORS policy", net::ERR_FAILED) and the honest
  // error state then reported "no preview" for EVERY persisted document. Measured
  // on one and the same document: the relative stream route resolved against the
  // API origin returns 200 image/png, the absolute signed one throws. The backend
  // contract says the same ("`url` is the authenticated, access-logged stream
  // route — use it for in-app viewing"), and it also never expires mid-session the
  // way the short-lived signature does.
  //
  // So: same-origin candidates FIRST (relative paths resolved against the API
  // origin, then absolutes that already sit on the page origin), cross-origin
  // absolutes only as a last resort — those still work in the bearer/rollback
  // setup where the configured API base IS that origin.
  const previewUrls = (() => {
    if (!doc) return [] as string[]
    const isAbs = (u?: string): u is string => Boolean(u && /^https?:\/\//.test(u))
    const rel = (u?: string) => (u && u.startsWith('/') ? new URL(u, API_ORIGIN).toString() : null)
    const sameOrigin = (u?: string) => (isAbs(u) && new URL(u).origin === window.location.origin ? u : null)
    const cross = (u?: string) => (isAbs(u) ? u : null)
    const ordered = [rel(doc.url), rel(doc.download_url), sameOrigin(doc.url), sameOrigin(doc.download_url), cross(doc.url), cross(doc.download_url)]
    return [...new Set(ordered.filter((u): u is string => Boolean(u)))]
  })()
  // Stable primitive key for the effect below — the array itself is rebuilt every render.
  const previewUrlKey = previewUrls.join('|')
  // Tries each candidate preview URL for the current document, resetting failure/blob state on a real change (previewUrlKey is a stable primitive so an equal-content array rebuild does not re-run this).
  useEffect(() => {
    setPdfFailed(false)
    setBlobUrl(null)
    setFetchState('idle')
    if (!doc) return
    if (doc.objectUrl) { setBlobUrl(doc.objectUrl); return }
    if (previewUrls.length === 0 || !previewable) return
    let cancelled = false
    let created: string | null = null
    setFetchState('loading')
    // PREVIEW-TENANT-HEADER-1 (Danny live 08-08: "Preview niet beschikbaar" on a
    // real, downloadable PNG): this is a RAW fetch, so it bypasses the axios
    // client and therefore its X-Tenant interceptor — and a tenant-scoped
    // document route answers 404 without that header, which the honest error
    // state then reported as "no preview". Measured: the same URL returns the
    // real image the moment the header rides along. Send the same headers the
    // shared client would.
    const tenant = getActiveTenantId()
    const headers = { 'X-Auth-Mode': 'cookie', ...(tenant ? { 'X-Tenant': tenant } : {}) }
    // Walk the candidates in order; the first one that actually returns bytes wins.
    // A blocked/refused candidate is not an error yet — only running out of them is.
    void (async () => {
      for (const url of previewUrls) {
        try {
          const res = await fetch(url, { credentials: 'include', headers })
          if (cancelled) return
          if (!res.ok) continue
          const blob = await res.blob()
          if (cancelled) return
          created = URL.createObjectURL(blob)
          setBlobUrl(created)
          setFetchState('idle')
          return
        } catch { /* CORS block / network error — fall through to the next candidate */ }
        if (cancelled) return
      }
      setFetchState('error')
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the doc's own identity fields (its url list/objectUrl), not the whole object — a parent that re-creates the doc object on every render (e.g. a `.map(d => ({ ...d, _i }))` spread) must never re-trigger this fetch.
  }, [previewUrlKey, doc?.objectUrl, previewable])

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
    // POPUP-SLEEP (Danny punt 19): the hand-rolled overlay is gone — this is the
    // shared FloatingPanel, so a preview can be dragged by its header and resized
    // while you read the record behind it, with the same focus trap/Escape as before.
    <FloatingPanel open onClose={onClose} ariaLabel={name || t('documents.previewUnavailable')}
      width={800} maxWidth="min(94vw, 800px)" persistKey="doc-preview"
      bodyStyle={{ background: 'var(--bg)', minHeight: 400 }}
      header={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: docColor(doc.type),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DocIcon size={13} color="var(--color-on-accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            {doc.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeLabel}</div>}
          </div>
        </div>
      )}>
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
          {t('documents.previewUnavailable')} {downloadHref && <a href={downloadHref} download={name} style={{ marginLeft: 6, color: 'var(--color-primary-text)' }}>{t('documents.download')}</a>}
        </div>
      )}
    </FloatingPanel>
  )
}
