/**
 * SubEntityImportCard — the "create these FROM A FILE" entry at the top of the
 * location/department/contact create modals (Danny 02-08: "+ Nieuwe afdeling, +
 * nieuwe locatie, + nieuwe contactpersoon ... moeten ook een CSV-upload hebben").
 * Reuses the Settings import wizard's dry-run/confirm/result machinery wholesale —
 * the exact same client + PreviewStep/ResultStep components CustomerImportCard
 * uses for the combined customer_tree file, never a second import client or a
 * second result renderer (CLAUDE.md §11).
 *
 * COMPACT-IMPORT-1 (Danny 02-08 live review, second round: "bij nieuwe locatie is
 * ook het download en upload csv-file veel te groot ... zorg dat + locatie net zo
 * groot is als + nieuwe klant"): the upload STEP used to render Settings' own
 * `UploadStep` — a full-page dashed dropzone (160px min-height) right for a
 * standalone Settings screen, wrong stacked above a create form the user came here
 * to fill in. This now hand-rolls the SAME compact one-line affordance
 * CustomerImportCard already had to build for the identical complaint (intro line +
 * one button row: select/download/accepted-types), so every "create from file"
 * card in the customers area — combined tree, location, department, contact —
 * shares one footprint. Fixed HERE (this file is the ONE shared card behind all
 * three sub-entity modals), not per-modal, so there is still one implementation.
 *
 * THE PARENT-MISMATCH RISK (measured against the backend — EntityImporter's
 * ResolvesCustomerTree trait): every one of these three importers matches its
 * parent BY NAME — a location row needs `klant_naam`, a department row needs
 * `klant_naam`+`locatie_naam`, a contact row needs all three. A name that matches
 * NOTHING is a hard row ERROR (ResolvesCustomerTree: "no customer named '…' exists
 * for this bureau" — never a silent create of a new customer). But a name that
 * matches a DIFFERENT REAL customer of this tenant resolves cleanly and writes
 * there — and this modal being open on one customer does nothing to stop that.
 * So this card is honest twice: (a) the idle copy states the matching rule up
 * front (reusing the settings wizard's own per-entity order-hint copy, one
 * source) plus an explicit warning naming the open customer, and (b) once the
 * dry run answers, every resolved row's `reference` ("CustomerName / …") is
 * checked against `customerName` — a mismatch blocks the plain Confirm button
 * behind an explicit acknowledgement dialog naming the other customer and the
 * row count, so nobody imports hundreds of rows into the wrong client while
 * believing the open drawer scoped it.
 */
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AlertTriangle, FileUp, FileText, Loader2 } from 'lucide-react'
import { cardBox } from '@/components/ui/modalCards'
import { BTN_H } from '@/config/buttonMetrics'
import { useConfirm } from '@/hooks/useConfirm'
import PreviewStep from '@/pages/settings/sections/importeren/PreviewStep'
import ResultStep from '@/pages/settings/sections/importeren/ResultStep'
import { downloadImportTemplate } from '@/pages/settings/sections/importeren/importApi'
import type { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
import type { ImportRowResult } from '@/pages/settings/sections/importeren/importApi'

// The three per-entity importers this card can drive — verified against the
// backend's ImportRegistry::IMPORTERS keys, never guessed from a display label.
export type SubEntityImportEntity = 'locations' | 'departments' | 'contacts'

// Shared title text for the CollapsedCard wrapping this card — the three caller
// modals (Location/Department/Contact) all need the exact same string for the
// collapsed header, so it lives here once instead of three duplicated t() calls.
export function subEntityImportTitle(t: TFunction, entity: SubEntityImportEntity): string {
  return t('subModal.import.title', { entity: t(`settings:import.entities.${entity}.label`) })
}

type Wizard = ReturnType<typeof useImportWizard>

interface SubEntityImportCardProps {
  entity: SubEntityImportEntity
  /** The customer this modal is scoped to — drives the parent-mismatch check below. */
  customerName?: string
  wizard: Wizard
  /** GET /imports/{entity}/template.csv — needs customers.view. */
  canView: boolean
  /** The dry-run AND the real import both need customers.create — an import is a bulk create. */
  canImport: boolean
}

// Mirrors ImportUploadRequest::rules (mimes:csv,txt) — an .xlsx must be refused
// client-side with the one instruction that helps, never accepted only to 422 later.
const ACCEPTED_EXTENSIONS = ['.csv', '.txt']

// A row that resolved a customer always carries a `reference` shaped
// "CustomerName / …" (every EntityImporter built on ResolvesCustomerTree composes
// it that way — see CustomerLocationImporter/CustomerDepartmentImporter/
// CustomerContactImporter). An ERROR row never resolved one, so it carries no
// such prefix and is excluded — it writes nothing, so there is no parent to warn about.
function rowParentName(row: ImportRowResult): string | null {
  if (row.action === 'error' || !row.reference) return null
  const separatorIndex = row.reference.indexOf(' / ')
  return separatorIndex === -1 ? row.reference : row.reference.slice(0, separatorIndex)
}

// Trim + lowercase compare — a UX safety net, not the enforcement itself (the
// dry run and the real run stay the actual authority on what resolves).
const normalize = (v: string) => v.trim().toLowerCase()

// Ghost button — one style, several labels; mirrors CustomerImportCard's own local constant.
const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

export default function SubEntityImportCard({ entity, customerName, wizard, canView, canImport }: SubEntityImportCardProps) {
  const { t } = useTranslation(['customers', 'settings'])
  const { confirm, dialog } = useConfirm()
  const { step, file, preview, run } = wizard
  // Reuses the settings screen's own entity labels (settings:import.entities.*) —
  // one source instead of a second "Locaties/Afdelingen/Contactpersonen" copy.
  const entityLabel = t(`settings:import.entities.${entity}.label`)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)
  const checking = preview.status === 'loading'

  // Rows whose resolved customer differs from the one this modal is scoped to —
  // computed once per successful preview; null while there is nothing to compare
  // (no preview yet, or the caller never told us which customer is open).
  const mismatch = useMemo(() => {
    if (preview.status !== 'success' || !customerName) return null
    const wanted = normalize(customerName)
    const otherRows = preview.result.rows.filter(row => {
      const name = rowParentName(row)
      return name !== null && normalize(name) !== wanted
    })
    if (otherRows.length === 0) return null
    const otherNames = Array.from(new Set(otherRows.map(row => rowParentName(row) as string)))
    return { count: otherRows.length, names: otherNames.join(', ') }
  }, [preview, customerName])

  // The real import is one click away in PreviewStep — intercepted here so a
  // parent mismatch asks first, naming the other customer and the row count.
  // No mismatch: fall straight through to the dry-run-confirmed real POST.
  const handleConfirm = () => {
    if (mismatch) {
      confirm(
        t('subModal.import.mismatchConfirm', { count: mismatch.count, names: mismatch.names }),
        () => wizard.confirmImport(),
        { title: t('subModal.import.mismatchTitle'), danger: true, confirmLabel: t('subModal.import.mismatchProceed') },
      )
      return
    }
    wizard.confirmImport()
  }

  // Reject anything that isn't .csv/.txt with an honest, actionable message — an
  // .xlsx must never be silently dropped, nor accepted only to fail server-side.
  const acceptFile = (candidate: File) => {
    const lower = candidate.name.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      setTypeError(t('import.wrongFileType', { ns: 'settings' }))
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

  // The whole compact card accepts a drop — no dedicated dashed drop zone (COMPACT-
  // IMPORT-1: keep the drop target without the vertical space a big box costs).
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (!canImport) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) acceptFile(dropped)
  }

  // GET /imports/{entity}/template.csv — this entity's own example, not the combined tree's.
  const handleDownloadTemplate = () => { void downloadImportTemplate(entity) }

  return (
    <>
      {/* The heading now lives in the caller's CollapsedCard title prop (see
          subEntityImportTitle above) — this card renders only its own boxed body. */}
      <div
        onDragOver={event => { event.preventDefault(); if (canImport) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ ...cardBox, gap: 8,
          border: dragOver ? '1px solid var(--color-primary)' : cardBox.border,
          background: dragOver ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : cardBox.background }}>

        {/* Step 1, no file yet: the matching-rule copy + parent warning, then ONE
            compact action row — select, download example, accepted-types hint. */}
        {step === 'upload' && !file && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('subModal.import.intro', { entity: entityLabel })}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(`settings:import.order.${entity}Hint`)}</div>
            {customerName && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                {t('subModal.import.parentWarning', { customerName })}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!canImport}
                title={canImport ? undefined : t('import.noImportPermission', { ns: 'settings' })}
                style={{ ...ghostBtn, borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                  color: 'var(--color-primary-text)', fontWeight: 600, opacity: canImport ? 1 : 0.5,
                  cursor: canImport ? 'pointer' : 'not-allowed' }}>
                <FileUp size={14} /> {t('import.selectCsv', { ns: 'settings' })}
              </button>
              <button type="button" onClick={handleDownloadTemplate} disabled={!canView}
                title={canView ? undefined : t('import.noViewPermission', { ns: 'settings' })}
                style={{ fontSize: 12, color: 'var(--color-primary-text)', background: 'none', border: 'none',
                  padding: 0, cursor: canView ? 'pointer' : 'not-allowed', opacity: canView ? 1 : 0.5 }}>
                {t('import.downloadTemplate', { ns: 'settings' })}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {t('import.acceptedTypes', { ns: 'settings' })}
              </span>
            </div>
            {typeError && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-danger)' }}>
                <AlertTriangle size={12} /> {typeError}
              </div>
            )}
            {!canImport && (
              <div style={{ fontSize: 11, color: 'var(--color-warning)' }}>{t('import.noImportPermission', { ns: 'settings' })}</div>
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
                {t('import.fileSelected', { ns: 'settings', name: file.name })}
              </span>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={checking}
                style={{ fontSize: 12, color: 'var(--color-primary-text)', background: 'none', border: 'none',
                  padding: 0, cursor: checking ? 'not-allowed' : 'pointer' }}>
                {t('import.replaceFile', { ns: 'settings' })}
              </button>
              <button type="button" onClick={wizard.runPreview} disabled={!canImport || checking}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px',
                  fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8,
                  background: 'var(--color-primary)', color: 'var(--color-on-accent)',
                  cursor: !canImport || checking ? 'not-allowed' : 'pointer', opacity: !canImport ? 0.5 : 1 }}>
                {checking && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {checking ? t('import.runningPreview', { ns: 'settings' }) : t('import.runPreview', { ns: 'settings' })}
              </button>
            </div>
            {preview.status === 'error' && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-danger)' }}>
                <AlertTriangle size={12} /> {preview.message || t('import.previewErrorFallback', { ns: 'settings' })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: the mandatory dry-run report — reused verbatim from Settings. */}
        {step === 'preview' && preview.status === 'success' && (
          <>
            {/* The concrete, measured warning — not a hypothetical: these EXACT rows
                resolved to a customer other than the one this modal is scoped to. */}
            {mismatch && (
              <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
                background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                borderRadius: 8, marginBottom: 12 }}>
                <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>
                  {t('subModal.import.mismatchWarning', { count: mismatch.count, names: mismatch.names })}
                </span>
              </div>
            )}
            <PreviewStep
              result={preview.result}
              runStatus={run.status}
              runError={run.status === 'error' ? run.message : undefined}
              canImport={canImport}
              onConfirm={handleConfirm}
              onBack={wizard.backToUpload}
            />
          </>
        )}

        {/* Only reached when the real run left NOTHING resolved — a clean import
            closes the modal before this ever renders (see each modal's own
            auto-close effect), so this is exclusively the "why nothing landed" case. */}
        {step === 'result' && run.status === 'success' && (
          <ResultStep result={run.result} onReset={wizard.reset} />
        )}

        {/* The real input: labelled for assistive tech, kept out of the tab order and
            out of sight — the visible button is what drives it (§6). */}
        <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleChange}
          aria-label={t('import.selectCsv', { ns: 'settings' })} tabIndex={-1} disabled={!canImport}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }} />
      </div>
      {dialog}
    </>
  )
}
