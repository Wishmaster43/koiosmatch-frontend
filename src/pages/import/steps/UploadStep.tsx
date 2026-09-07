/**
 * UploadStep (wizard step 1) — download the example file, then pick a CSV to parse
 * CLIENT-SIDE (no backend call yet — that only happens once the mapped preview is
 * validated in step 3). Parses .csv/.txt only (no .xlsx) because it uses lib/csv.ts
 * which is text-only; see settings/sections/import/UploadStep.tsx for the server
 * preview version that accepts binary .xlsx files.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadImportTemplate } from '../api'
import { notifyError } from '@/lib/notify'
import { FileDropZoneUI } from '../shared'

// Client-side CSV parsing only — .xlsx would be mojibake (no xlsx reader in this repo).
const ACCEPTED_EXTENSIONS = ['.csv', '.txt']

interface UploadStepProps {
  entity: string
  canView: boolean
  canImport: boolean
  /** Parses the file and advances to the mapping step; may reject on a read error. */
  onFileReady: (file: File) => Promise<void>
}

// Wizard step 1: dropzone that validates file type and parses CSV client-side.
export default function UploadStep({ entity, canView, canImport, onFileReady }: UploadStepProps) {
  const { t } = useTranslation('settings')
  const [typeError, setTypeError] = useState<string | null>(null)
  const [downloadPending, setDownloadPending] = useState(false)
  const [parsing, setParsing] = useState(false)

  // Validate file type and parse client-side; reject .xlsx (text-only parser).
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

  // Download template CSV from the backend.
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

  return (
    <FileDropZoneUI
        dropHint={t('import.dropHere')}
      entity={entity}
      canView={canView}
      canImport={canImport}
      acceptAttribute=".csv,.txt"
      acceptedTypesHint={t('import.acceptedTypesCsvOnly')}
      downloadLabel={t('import.downloadTemplate')}
      selectLabel={t('import.selectCsv')}
      noImportPermissionMessage={t('import.noImportPermission')}
      noViewPermissionHint={t('import.noViewPermission')}
      onFileAccepted={acceptFile}
      disabled={parsing}
      onDownloadTemplate={handleDownloadTemplate}
      downloadPending={downloadPending}
      parsing={parsing}
      typeError={typeError}
    />
  )
}
