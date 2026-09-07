/**
 * UploadStep — step 1 for settings import: stage a file and run server-side preview.
 * Accepts .csv/.txt/.xlsx for spreadsheets or .zip for documents (entity-dependent).
 * Does not parse client-side; the server handles all format reading.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadImportTemplate } from './importApi'
import { notifyError } from '@/lib/notify'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { FileDropZoneUI } from '@/pages/import/shared'

// Documents entity accepts ZIP (files + mapping.csv); others accept spreadsheets only.
const ZIP_ENTITIES = ['documents']
const ZIP_MAX_MB = 200

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

// Settings import: stage file and optionally run server-side preview.
export default function UploadStep({
  entity, file, onSelectFile, onRunPreview, previewStatus, previewError, canView, canImport,
}: UploadStepProps) {
  const { t } = useTranslation('settings')
  const [typeError, setTypeError] = useState<string | null>(null)
  const [downloadPending, setDownloadPending] = useState(false)

  const isZip = ZIP_ENTITIES.includes(entity)
  const acceptAttribute = isZip ? '.zip' : '.csv,.txt,.xlsx'

  // Validate file type and size before staging.
  const acceptFile = (candidate: File) => {
    const lower = candidate.name.toLowerCase()
    const isValidZip = lower.endsWith('.zip')
    const isValidSpreadsheet = ['.csv', '.txt', '.xlsx'].some(ext => lower.endsWith(ext))

    if (isZip && !isValidZip) {
      setTypeError(t('import.wrongFileType'))
      return
    }
    if (!isZip && !isValidSpreadsheet) {
      setTypeError(t('import.wrongFileType'))
      return
    }
    if (isZip && candidate.size > ZIP_MAX_MB * 1024 * 1024) {
      setTypeError(t('import.zipTooLarge', { max: ZIP_MAX_MB }))
      return
    }
    setTypeError(null)
    onSelectFile(candidate)
  }

  // Download template file from the backend.
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

  const checking = previewStatus === 'loading'

  return (
    <div>
      <FileDropZoneUI
        dropHint={t('import.dropHere')}
        entity={entity}
        canView={canView}
        canImport={canImport}
        acceptAttribute={acceptAttribute}
        acceptedTypesHint={t(isZip ? 'import.acceptedTypesZip' : 'import.acceptedTypes')}
        downloadLabel={t('import.downloadTemplate')}
        selectLabel={t('import.selectCsv')}
        noImportPermissionMessage={t('import.noImportPermission')}
        noViewPermissionHint={t('import.noViewPermission')}
        onFileAccepted={acceptFile}
        disabled={checking}
        onDownloadTemplate={handleDownloadTemplate}
        downloadPending={downloadPending}
        parsing={checking}
        typeError={typeError}
        selectedFile={file}
        replaceFileLabel={t('import.replaceFile')}
        fileSelectedLabel={(name) => t('import.fileSelected', { name })}
      />

      {/* Preview error */}
      {previewStatus === 'error' && (
        <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>
          {previewError || t('import.previewErrorFallback')}
        </p>
      )}

      {/* Run preview button */}
      <div style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onRunPreview} disabled={!file || !canImport || checking}>
          {checking && <Spinner size={14} />}
          {checking ? t('import.runningPreview') : t('import.runPreview')}
        </Button>
      </div>
    </div>
  )
}
