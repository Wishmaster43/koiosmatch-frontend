/**
 * EntityImportCard — the "create these FROM A FILE" entry at the TOP of a create
 * modal, in CvUploadCard's exact compact footprint (Danny 02-08 live review: "+
 * nieuwe klant moet net zo groot zijn als + nieuwe kandidaat. Sleep csv import
 * bestand blok is te groot nu" — + new customer must be exactly as big as + new
 * candidate; the drag-CSV-import-file block is too big right now). Settings' own
 * UploadStep has a big dashed drop zone that is right for a full Settings page,
 * wrong above a create form the user came here to fill in — so THIS step-1 row
 * is hand-rolled to CvUploadCard's own
 * compact shape (one intro line, one button row, one hint line) instead of reusing
 * UploadStep wholesale. That is the ONLY fork in the whole wizard: the state
 * machine, the dry-run/real-run API calls, and the per-row PREVIEW/RESULT panels
 * are still reused verbatim from Settings, never a second import client or result
 * renderer (CLAUDE.md §11).
 *
 * GENERALISED (2026-08-14, EXCEL-VACATURES-1): this used to be customers-only
 * (`CustomerImportCard`, hardcoded to the `customer_tree` entity). It is now the
 * ONE shared card behind every "create record(s) directly from a whole-record
 * file" flow in a create modal — customers (customer_tree, `wholeTree`) AND
 * vacancies (`vacancies`, one row = one record). The entity/template id and the
 * intro copy are props so a new caller never forks a second copy.
 *
 * PARENT-mismatch callers (locations/departments/contacts scoped under an
 * already-open customer, `SubEntityImportCard`) reuse this SAME step rendering
 * via `introExtra` (order-hint/parent-warning copy under the intro line),
 * `previewBanner` (the measured mismatch alert above the dry-run report) and
 * `onConfirmImport` (an interceptor in front of `wizard.confirmImport` that
 * gates a mismatched import behind an extra confirm) — never a second copy of
 * the upload/preview/result steps.
 *
 * Presentational only: the wizard state (useImportWizard) is owned by the PARENT
 * modal (AddCustomerModal / AddVacancyModal), exactly like useCvParse/CvUploadCard,
 * so the parent can react to a successful import (close + refresh the list)
 * without this component knowing anything about closing itself.
 */
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, FileText, AlertTriangle, Download } from 'lucide-react'
import { cardBox } from '@/components/ui/modalCards'
import Spinner from '@/components/ui/Spinner'
// CUSTOMER-IMPORT-1 (Danny 02-08): the PREVIEW/RESULT panels and the download-
// template call are reused straight from Settings' working import wizard — cross-
// page import, deliberate and written up here: reusing beats a second import
// client or a second result renderer.
import { PreviewStep, ResultStep, downloadImportTemplate } from '@/pages/settings/shared'
import type { useImportWizard } from '@/pages/settings/shared'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder } from '@/lib/tint'
import { Caption } from '@/components/ui/typography'

// Mirrors ImportUploadRequest::rules (mimes:csv,txt,xlsx) — this card only forwards
// the raw File to the backend (no client-side parsing), so .xlsx works exactly like
// .csv/.txt here; the excel reader recognises it by its ZIP magic server-side.
const ACCEPTED_EXTENSIONS = ['.csv', '.txt', '.xlsx']

type Wizard = ReturnType<typeof useImportWizard>

interface EntityImportCardProps {
  wizard: Wizard
  /** GET /imports/{entity}/template.csv permission — the caller resolves the right pair (importPermissionsFor). */
  canView: boolean
  /** The dry-run AND the real import both need the caller's create right — an import is a bulk create. */
  canImport: boolean
  /** The backend importer key (ImportRegistry::IMPORTERS) — drives the "download example" template. */
  entity: string
  /** Already-translated intro line — the caller owns the copy/namespace for its own entity. */
  intro: string
  /** True only for a combined file where one row can touch several linked records (e.g. customer_tree). */
  wholeTree?: boolean
  /** Extra content under the intro line, before the button row — e.g. SubEntityImportCard's order-hint + parent-name warning. */
  introExtra?: ReactNode
  /** Extra content above the mandatory dry-run preview — e.g. SubEntityImportCard's measured parent-mismatch alert. */
  previewBanner?: ReactNode
  /** Confirm override for the dry-run preview step — defaults to `wizard.confirmImport`; SubEntityImportCard intercepts it to gate a parent mismatch behind an extra confirm dialog. */
  onConfirmImport?: () => void
}

// The compact "create from a file" card at the top of a create modal: pick →
// mandatory dry-run preview → real import, reusing the Settings wizard's own steps.
export default function EntityImportCard({ wizard, canView, canImport, entity, intro, wholeTree = false, introExtra, previewBanner, onConfirmImport }: EntityImportCardProps) {
  const { t } = useTranslation('settings')
  const { step, file, preview, run } = wizard
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)
  const checking = preview.status === 'loading'

  // Reject anything that isn't .csv/.txt/.xlsx with an honest, actionable message — an
  // .xlsx must never be silently dropped, nor accepted only to fail server-side.
  const acceptFile = (candidate: File) => {
    const lower = candidate.name.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      setTypeError(t('import.wrongFileType'))
      return
    }
    setTypeError(null)
    wizard.selectFile(candidate)
  }

  // Clear the input after reading so picking the SAME file again still fires change.
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (picked) acceptFile(picked)
  }

  // The whole compact card accepts a drop — no dedicated dashed drop zone (Danny
  // 02-08: keep the drop target without the vertical space a big box costs).
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (!canImport) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) acceptFile(dropped)
  }

  const handleDownloadTemplate = () => { void downloadImportTemplate(entity) }

  // The heading lives in the caller's own card wrapper (cardHead) — this returns
  // only the self-boxed drag/drop surface.
  return (
    <div
      onDragOver={event => { event.preventDefault(); if (canImport) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ ...cardBox, gap: 8,
        border: dragOver ? tintBorder('var(--button-fill)', true) : cardBox.border,
        background: dragOver ? tintBg('var(--button-fill)') : cardBox.background }}>

      {/* Step 1, no file yet: the honest distinction + ONE compact action row —
          select, download example, accepted-types hint, all on one line. */}
      {step === 'upload' && !file && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{intro}</div>
          {introExtra}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* HUISSTIJL-1: the primary create action of this step reads the house
                trio, solid — same as every other accent action button. */}
            <Button type="button" variant="primary" onClick={() => inputRef.current?.click()} disabled={!canImport}
              title={canImport ? undefined : t('import.noImportPermission')} style={{ gap: 6 }}>
              <FileUp size={14} /> {t('import.selectCsv')}
            </Button>
            {/* POP-UPS 3.5: de template-download is een KNOP met icoon — de oude
                gekleurde tekstlink was precies het 08-08-anti-patroon. */}
            <Button type="button" variant="secondary" onClick={handleDownloadTemplate} disabled={!canView}
              title={canView ? undefined : t('import.noViewPermission')} style={{ gap: 6 }}>
              <Download size={13} /> {t('import.downloadTemplate')}
            </Button>
            <Caption style={{ marginLeft: 'auto' }}>
              {t('import.acceptedTypes')}
            </Caption>
          </div>
          {typeError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-danger-text)' }}>
              <AlertTriangle size={12} /> {typeError}
            </div>
          )}
          {!canImport && (
            <div style={{ fontSize: 11, color: 'var(--color-warning-text)' }}>{t('import.noImportPermission')}</div>
          )}
        </>
      )}

      {/* Step 1, file picked: one row — filename, a "different file" link, and the
          mandatory-dry-run trigger. Never a shortcut straight to the real import. */}
      {step === 'upload' && file && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', minWidth: 0, overflowWrap: 'anywhere' }}>
              {t('import.fileSelected', { name: file.name })}
            </span>
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={checking}>
              {t('import.replaceFile')}
            </Button>
            <Button variant="primary" size="sm" onClick={wizard.runPreview} disabled={!canImport || checking}
              style={{ marginLeft: 'auto' }}>
              {checking && <Spinner size={13} />}
              {checking ? t('import.runningPreview') : t('import.runPreview')}
            </Button>
          </div>
          {preview.status === 'error' && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-danger-text)' }}>
              <AlertTriangle size={12} /> {preview.message || t('import.previewErrorFallback')}
            </div>
          )}
        </div>
      )}

      {/* Step 2: the mandatory dry-run report — reused verbatim from Settings. */}
      {step === 'preview' && preview.status === 'success' && (
        <>
          {previewBanner}
          <PreviewStep
            result={preview.result}
            runStatus={run.status}
            runError={run.status === 'error' ? run.message : undefined}
            canImport={canImport}
            wholeTree={wholeTree}
            onConfirm={onConfirmImport ?? wizard.confirmImport}
            onBack={wizard.backToUpload}
          />
        </>
      )}

      {/* Only reached when the real run left NOTHING resolved (see useEntityImportCard's
          auto-close effect) — a clean import closes the modal before this ever renders,
          so this is exclusively the "here is why nothing landed" explanation. */}
      {step === 'result' && run.status === 'success' && (
        <ResultStep result={run.result} wholeTree={wholeTree} onReset={wizard.reset} />
      )}

      {/* The real input: labelled for assistive tech, kept out of the tab order and
          out of sight — the visible button is what drives it (§6). */}
      <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx" onChange={handleChange}
        aria-label={t('import.selectCsv')} tabIndex={-1} disabled={!canImport}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }} />
    </div>
  )
}
