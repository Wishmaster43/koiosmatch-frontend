/**
 * UploadStep (wizard step 1) — download the example file, then pick a CSV to parse
 * CLIENT-SIDE (no backend call yet — that only happens once the mapped preview is
 * validated in step 3). Mirrors settings/importeren/UploadStep.tsx's dropzone and
 * permission notices; the primary action differs (that screen's button runs the
 * backend dry-run immediately, this one only parses the file locally and moves to
 * the column-mapping step) and so does the accepted file type: THIS screen stays
 * .csv/.txt only (own i18n keys, *CsvOnly) because it parses client-side with no
 * xlsx support, while the other screen also accepts .xlsx (the backend parses it).
 */
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudUpload, Download, Loader2 } from 'lucide-react'
import { downloadImportTemplate } from '../api'
import { notifyError } from '@/lib/notify'

// The backend also accepts .xlsx (ImportUploadRequest: mimes:csv,txt,xlsx), but THIS
// screen parses the file client-side for column mapping (lib/csv.ts, text-only — no
// xlsx parsing library in this repo) before anything is uploaded, so a binary .xlsx
// would only produce mojibake here. Left at .csv/.txt on purpose; see
// settings/sections/importeren/UploadStep.tsx for the raw-upload screen that DOES
// take .xlsx (it never parses client-side, the backend reads it directly).
const ACCEPTED_EXTENSIONS = ['.csv', '.txt']

interface UploadStepProps {
  entity: string
  canView: boolean
  canImport: boolean
  /** Parses the file and advances to the mapping step; may reject on a read error. */
  onFileReady: (file: File) => Promise<void>
}

export default function UploadStep({ entity, canView, canImport, onFileReady }: UploadStepProps) {
  const { t } = useTranslation('settings')
  const [drag, setDrag] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [downloadPending, setDownloadPending] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reject anything that isn't .csv/.txt with an honest, actionable message. Its own
  // key (not the shared import.wrongFileType) because this screen genuinely cannot
  // take .xlsx yet — see the ACCEPTED_EXTENSIONS comment above.
  const acceptFile = async (candidate: File) => {
    const lower = candidate.name.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setTypeError(t('import.wrongFileTypeCsvOnly'))
      return
    }
    setTypeError(null)
    setParsing(true)
    try {
      await onFileReady(candidate)
    } catch {
      notifyError(t('import.previewErrorFallback'))
    } finally {
      setParsing(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setDownloadPending(true)
    try {
      await downloadImportTemplate(entity)
    } catch {
      notifyError(t('import.downloadError'))
    } finally {
      setDownloadPending(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDrag(false)
    if (!canImport) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) void acceptFile(dropped)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (picked) void acceptFile(picked)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 8, marginBottom: 16, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t('import.downloadTemplate')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.downloadTemplateHint')}</div>
        </div>
        <button type="button" onClick={handleDownloadTemplate} disabled={!canView || downloadPending}
          title={canView ? undefined : t('import.noViewPermission')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13,
                   border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)',
                   cursor: !canView || downloadPending ? 'not-allowed' : 'pointer', opacity: !canView ? 0.5 : 1, flexShrink: 0 }}>
          {downloadPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} />}
          {t('import.downloadTemplate')}
        </button>
      </div>

      {!canImport && (
        <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 12 }}>{t('import.noImportPermission')}</p>
      )}

      <div
        onDragOver={(event) => { event.preventDefault(); if (canImport) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => canImport && !parsing && fileRef.current?.click()}
        style={{ border: `2px dashed ${drag ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 10,
                 minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                 gap: 12, cursor: canImport ? 'pointer' : 'not-allowed', opacity: canImport ? 1 : 0.5,
                 background: drag ? 'var(--color-primary-bg)' : 'var(--hover-bg)', transition: 'all 0.15s' }}>
        {parsing
          ? <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary-text)' }} aria-hidden="true" />
          : <CloudUpload size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('import.dropHere')}</span>
        <button type="button" onClick={(event) => { event.stopPropagation(); if (canImport && !parsing) fileRef.current?.click() }}
          disabled={!canImport || parsing}
          style={{ height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8,
                   background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: canImport && !parsing ? 'pointer' : 'not-allowed' }}>
          {t('import.selectCsv')}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('import.acceptedTypesCsvOnly')}</span>
        <input ref={fileRef} type="file" accept=".csv,.txt" aria-label={t('import.selectCsv')}
          style={{ display: 'none' }} onChange={handleFileInput} disabled={!canImport || parsing} />
      </div>

      {typeError && <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 10 }}>{typeError}</p>}
    </div>
  )
}
