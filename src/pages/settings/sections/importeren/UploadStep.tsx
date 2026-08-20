/**
 * UploadStep — step 1: download the example file, then upload a CSV to preview.
 * The upload dropzone is DISABLED (never hidden) for a user without customers.create
 * — they can still see the entity and download its template (§3: "renders disabled
 * with an honest notice" beats a button that would 403).
 */
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudUpload, Download } from 'lucide-react'
import { downloadImportTemplate } from './importApi'
import { notifyError } from '@/lib/notify'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

// Only these extensions are ever accepted by the backend (ImportUploadRequest:
// mimes:csv,txt,xlsx) — .xlsx is read by its own reader (ZIP magic + Excel's own
// sheet row numbers), never converted client-side.
const ACCEPTED_EXTENSIONS = ['.csv', '.txt', '.xlsx']

interface UploadStepProps {
  entity: string
  file: File | null
  onSelectFile: (file: File) => void
  onRunPreview: () => void
  previewStatus: 'idle' | 'loading' | 'error' | 'success'
  previewError?: string
  canView: boolean
  canImport: boolean
}

export default function UploadStep({
  entity, file, onSelectFile, onRunPreview, previewStatus, previewError, canView, canImport,
}: UploadStepProps) {
  const { t } = useTranslation('settings')
  const [drag, setDrag] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [downloadPending, setDownloadPending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const checking = previewStatus === 'loading'

  // Reject anything that isn't .csv/.txt/.xlsx with an honest, actionable message.
  const acceptFile = (candidate: File) => {
    const lower = candidate.name.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setTypeError(t('import.wrongFileType'))
      return
    }
    setTypeError(null)
    onSelectFile(candidate)
  }

  // GET /imports/{entity}/template.csv, streamed to disk — the "export as example" feature.
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
    if (dropped) acceptFile(dropped)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (picked) acceptFile(picked)
  }

  return (
    <div>
      {/* The example file — one click, filled-in rows included. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 8, marginBottom: 16, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t('import.downloadTemplate')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.downloadTemplateHint')}</div>
        </div>
        <Button variant="secondary" onClick={handleDownloadTemplate} disabled={!canView || downloadPending}
          title={canView ? undefined : t('import.noViewPermission')}>
          {downloadPending ? <Spinner size={14} /> : <Download size={14} />}
          {t('import.downloadTemplate')}
        </Button>
      </div>

      {!canImport && (
        <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 12 }}>{t('import.noImportPermission')}</p>
      )}

      {/* Upload dropzone — disabled (opacity + cursor), never hidden, without the create right. */}
      <div
        onDragOver={(event) => { event.preventDefault(); if (canImport) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => canImport && fileRef.current?.click()}
        style={{ border: `2px dashed ${drag ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 10,
                 minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                 gap: 12, cursor: canImport ? 'pointer' : 'not-allowed', opacity: canImport ? 1 : 0.5,
                 background: drag ? 'var(--color-primary-bg)' : 'var(--hover-bg)', transition: 'all 0.15s' }}>
        <CloudUpload size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('import.dropHere')}</span>
        <Button variant="primary" onClick={(event) => { event.stopPropagation(); if (canImport) fileRef.current?.click() }}
          disabled={!canImport}>
          {t('import.selectCsv')}
        </Button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('import.acceptedTypes')}</span>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" aria-label={t('import.selectCsv')}
          style={{ display: 'none' }} onChange={handleFileInput} disabled={!canImport} />
      </div>

      {typeError && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{typeError}</p>}

      {file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success)',
          borderRadius: 8, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{t('import.fileSelected', { name: file.name })}</span>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!canImport}
            style={{ fontSize: 12, color: 'var(--color-primary-text)', background: 'none', border: 'none',
                     cursor: canImport ? 'pointer' : 'not-allowed', padding: 0 }}>
            {t('import.replaceFile')}
          </button>
        </div>
      )}

      {previewStatus === 'error' && (
        <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>
          {previewError || t('import.previewErrorFallback')}
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onRunPreview} disabled={!file || !canImport || checking}>
          {checking && <Spinner size={14} />}
          {checking ? t('import.runningPreview') : t('import.runPreview')}
        </Button>
      </div>
    </div>
  )
}
