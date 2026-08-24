/**
 * IbanDocumentSlot — DOC-BANK-2 (Danny 24-08: "een document kunnen koppelen aan
 * een IBAN en zakelijke ZZP-IBAN, met preview en download en change icon").
 * Completes the DOC-BANK-1 field mechanism: ONE shared slot for both bank
 * accounts — the private card writes `bank_document_id` on the candidate root,
 * the ZZP Facturatie card writes the same field on the freelance profile (both
 * fields pre-exist server-side; the host owns WHICH patch its onLink fires).
 *
 * Linked: filename + preview (shared DocPreviewModal) + download + the change
 * pencil reopening the picker (which also carries the clear action — an
 * optional link is always emptiable). Unlinked: one honest "Document koppelen"
 * button. The picker offers the candidate's EXISTING documents (searchable)
 * or an inline upload through the same multipart route the Documents tab uses
 * — never a second upload client (§11); a fresh upload is remembered locally
 * so it resolves before the drawer's next refresh.
 */
import { useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, Edit2, X, Upload, Link2 } from 'lucide-react'
import api from '@/lib/api'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SearchSelectJs from '@/components/ui/SearchSelect'
import { Caption, Mono } from '@/components/ui/typography'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'

type Loose = Record<string, unknown>
type AnyProps = Record<string, unknown>
const SearchSelect = SearchSelectJs as unknown as ComponentType<AnyProps>

export default function IbanDocumentSlot({ candidateId, documents = [], linkedDocumentId, onLink, preferredType }: {
  candidateId: string | number
  documents?: Loose[]
  // undefined = the server omitted the field (no financial permission) — the
  // host hides the whole row; null = present but empty (link offer renders).
  linkedDocumentId?: string | number | null
  // Persists the link (id) or clears it (null) — the host owns the PATCH shape.
  onLink: (documentId: string | null) => void
  // Default document type for the inline upload (seeded per slot: "Bankpas
  // privé" / "Bankpas zakelijk") — used only when the tenant's lookup actually
  // carries it, else the first type; the user can always pick another.
  preferredType?: string
}) {
  const { t } = useTranslation('candidates')
  const [picking, setPicking] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Loose | null>(null)
  // Fresh uploads resolve immediately from here until the drawer refreshes.
  const [localDocs, setLocalDocs] = useState<Loose[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const { types } = useDocumentTypes('candidate')
  const [uploadType, setUploadType] = useState('')
  const preferredAvailable = preferredType && types.some((tp: { value: string }) => String(tp.value) === preferredType)
  const defaultType = preferredAvailable ? String(preferredType) : String(types[0]?.value ?? '')
  const fileRef = useRef<HTMLInputElement | null>(null)

  if (linkedDocumentId === undefined) return null

  const allDocs = [...localDocs, ...documents]
  const linkedDoc = linkedDocumentId != null ? allDocs.find(d => String(d.id) === String(linkedDocumentId)) : undefined
  const docName = (d: Loose) => String(d.name ?? d.file_name ?? d.type ?? d.id)

  const download = () => linkedDoc && downloadFilesSequentially([{ url: (linkedDoc.url as string) ?? (linkedDoc.download_url as string), name: docName(linkedDoc) }])

  // Inline upload through the ONE existing multipart route, then link the
  // fresh id — the type defaults to the first lookup value until picked.
  const uploadAndLink = (file: File) => {
    setUploading(true); setUploadError(false)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', uploadType || defaultType)
    fd.append('name', file.name)
    api.post(`/candidates/${candidateId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => {
        const doc = ((res.data as Loose)?.data ?? res.data) as Loose
        if (doc?.id != null) {
          setLocalDocs(prev => [doc, ...prev])
          onLink(String(doc.id))
          setPicking(false)
        } else {
          setUploadError(true)
        }
      })
      .catch(() => setUploadError(true))
      .finally(() => setUploading(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {linkedDoc ? (
          <>
            <Mono style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{docName(linkedDoc)}</Mono>
            <Button variant="ghost" iconOnly size="sm" aria-label={t('documents.preview')} title={t('documents.preview')} onClick={() => setPreviewDoc(linkedDoc)}><Eye size={13} /></Button>
            <Button variant="ghost" iconOnly size="sm" aria-label={t('documents.download')} title={t('documents.download')} onClick={download}><Download size={13} /></Button>
            <Button variant="ghost" iconOnly size="sm" aria-label={t('bankDoc.change')} title={t('bankDoc.change')} onClick={() => setPicking(v => !v)}><Edit2 size={13} /></Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setPicking(v => !v)}>
            <Link2 size={13} /> {t('bankDoc.link')}
          </Button>
        )}
      </div>

      {picking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Existing documents — one pick links and closes. */}
            <SearchSelect triggerLabel={t('bankDoc.chooseExisting')} selectAll={false}
              options={documents.filter(d => d.id != null).map(d => ({ value: String(d.id), label: docName(d) }))}
              selected={linkedDocumentId != null ? [String(linkedDocumentId)] : []}
              onToggle={(v: string) => { onLink(v); setPicking(false) }} />
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" iconOnly onClick={() => setPicking(false)} aria-label={t('bankDoc.close')} title={t('bankDoc.close')}><X size={13} /></Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Inline upload: type first (lookup-driven), then the file. */}
            <SearchSelect triggerLabel={uploadType || defaultType} selectAll={false}
              options={types.map((tp: { value: string; label: string }) => ({ value: String(tp.value), label: tp.label }))}
              selected={[uploadType || defaultType]}
              onToggle={(v: string) => setUploadType(v)} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner size={13} /> : <Upload size={13} />} {t('bankDoc.uploadNew')}
            </Button>
            {/* The optional link is always emptiable (house rule): clear lives here. */}
            {linkedDocumentId != null && (
              <Button variant="ghost" size="sm" onClick={() => { onLink(null); setPicking(false) }}>
                <X size={13} /> {t('bankDoc.clear')}
              </Button>
            )}
          </div>
          {uploadError && <Caption as="div" style={{ color: 'var(--color-danger-text)' }}>{t('bankDoc.uploadFailed')}</Caption>}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
            aria-label={t('bankDoc.uploadNew')}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAndLink(f); e.target.value = '' }} />
        </div>
      )}

      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
