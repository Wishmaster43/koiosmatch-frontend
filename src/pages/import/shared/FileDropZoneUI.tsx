/**
 * FileDropZoneUI — shared dropzone + template download UI for both the wizard
 * and settings import screens. Handles drag/drop/click file selection and
 * template download, without state management (pure presentation).
 * Callers provide the file acceptance logic and optional file staging/preview UI.
 */
import { useRef, useState, type ChangeEvent, type DragEvent, ReactNode } from 'react'
import { CloudUpload, Download } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { BodyText, Caption } from '@/components/ui/typography'

interface FileDropZoneUIProps {
  entity: string
  canView: boolean
  canImport: boolean
  /** Extension filter hint (e.g. '.csv,.txt' or '.csv,.txt,.xlsx'). */
  acceptAttribute: string
  /** Localized hint text (e.g. t('import.acceptedTypes') or t('import.acceptedTypesCsvOnly')). */
  acceptedTypesHint: ReactNode
  /** Download button label (usually t('import.downloadTemplate')). */
  downloadLabel: ReactNode
  /** Browse button label (usually t('import.selectCsv')). */
  selectLabel: ReactNode
  /** Drop-zone hint (t('import.dropHere')); the caller owns the copy so it stays translated. */
  dropHint: ReactNode
  /** Message shown when import permission denied (usually t('import.noImportPermission')). */
  noImportPermissionMessage: ReactNode
  /** Title hint for download button when view permission denied (usually t('import.noViewPermission')). */
  noViewPermissionHint?: ReactNode
  /** Called on file drop or selection via input. */
  onFileAccepted: (file: File) => void
  /** Disable the dropzone during file parsing/preview. */
  disabled?: boolean
  /** Called when download button clicked. */
  onDownloadTemplate: () => void
  /** Show spinner in download button (true = downloading). */
  downloadPending?: boolean
  /** Show spinner in dropzone (true = parsing/processing). */
  parsing?: boolean
  /** File type error message, if any. */
  typeError?: string | null
  /** Selected file (if set, shows success display + replace button). */
  selectedFile?: File | null
  /** Label for replace button (e.g. t('import.replaceFile')). */
  replaceFileLabel?: ReactNode
  /** Label for file selected message (e.g. t('import.fileSelected')). */
  fileSelectedLabel?: (name: string) => ReactNode
}

export default function FileDropZoneUI({
  entity, canView, canImport, acceptAttribute, acceptedTypesHint, downloadLabel, selectLabel, dropHint,
  noImportPermissionMessage, onFileAccepted, disabled = false, onDownloadTemplate, downloadPending = false,
  parsing = false, typeError, selectedFile, replaceFileLabel, fileSelectedLabel, noViewPermissionHint,
}: FileDropZoneUIProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  // File drop handler — ignore if import not permitted.
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDrag(false)
    if (!canImport || disabled) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) onFileAccepted(dropped)
  }

  // File input change handler.
  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (picked) onFileAccepted(picked)
  }

  const canClick = canImport && !disabled && !parsing
  const dropzoneDisabled = !canImport || disabled

  return (
    <div>
      {/* Template download card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 8, marginBottom: 16, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <BodyText as="div" style={{ fontWeight: 500 }}>{downloadLabel}</BodyText>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {entity ? `${entity} — .csv` : '.csv'}
          </div>
        </div>
        <Button variant="secondary" onClick={onDownloadTemplate} disabled={!canView || downloadPending}
          title={canView ? undefined : (noViewPermissionHint ? String(noViewPermissionHint) : undefined)}>
          {downloadPending ? <Spinner size={14} /> : <Download size={14} />}
          {downloadLabel}
        </Button>
      </div>

      {/* Permission notice */}
      {!canImport && (
        <p style={{ fontSize: 12, color: 'var(--color-warning-text)', marginBottom: 12 }}>{noImportPermissionMessage}</p>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(event) => { event.preventDefault(); if (canImport && !disabled) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => canClick && fileRef.current?.click()}
        style={{ border: `2px dashed ${drag ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 10,
                 minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                 gap: 12, cursor: canClick ? 'pointer' : 'not-allowed', opacity: dropzoneDisabled ? 0.5 : 1,
                 background: drag ? 'var(--color-primary-bg)' : 'var(--hover-bg)', transition: 'all 0.15s' }}>
        {parsing
          ? <span style={{ color: 'var(--color-primary-text)' }}><Spinner size={28} /></span>
          : <CloudUpload size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
        <BodyText as="span" style={{ color: 'var(--text-muted)' }}>{dropHint}</BodyText>
        <Button variant="primary" onClick={(event) => { event.stopPropagation(); if (canClick) fileRef.current?.click() }}
          disabled={dropzoneDisabled || parsing}>
          {selectLabel}
        </Button>
        <Caption as="span">{acceptedTypesHint}</Caption>
        <input ref={fileRef} type="file" accept={acceptAttribute} aria-label={String(selectLabel)}
          style={{ display: 'none' }} onChange={handleFileInput} disabled={dropzoneDisabled || parsing} />
      </div>

      {/* Type error */}
      {typeError && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{typeError}</p>}

      {/* File selected display (optional) */}
      {selectedFile && fileSelectedLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success)',
          borderRadius: 8, marginTop: 12 }}>
          <BodyText as="span" style={{ flex: 1 }}>{fileSelectedLabel(selectedFile.name)}</BodyText>
          {replaceFileLabel && (
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={!canImport || disabled}>
              {replaceFileLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
