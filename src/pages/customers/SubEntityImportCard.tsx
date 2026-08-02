/**
 * SubEntityImportCard — the "create these FROM A FILE" entry at the top of the
 * location/department/contact create modals (Danny 02-08: "+ Nieuwe afdeling, +
 * nieuwe locatie, + nieuwe contactpersoon ... moeten ook een CSV-upload hebben").
 * Reuses the Settings import wizard wholesale (upload -> mandatory dry-run ->
 * confirm -> result) — the exact same step components and client CustomerImportCard
 * uses for the combined customer_tree file, never a second import client or a
 * second result renderer (CLAUDE.md §11).
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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { useConfirm } from '@/hooks/useConfirm'
import UploadStep from '@/pages/settings/sections/importeren/UploadStep'
import PreviewStep from '@/pages/settings/sections/importeren/PreviewStep'
import ResultStep from '@/pages/settings/sections/importeren/ResultStep'
import type { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
import type { ImportRowResult } from '@/pages/settings/sections/importeren/importApi'

// The three per-entity importers this card can drive — verified against the
// backend's ImportRegistry::IMPORTERS keys, never guessed from a display label.
export type SubEntityImportEntity = 'locations' | 'departments' | 'contacts'

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

export default function SubEntityImportCard({ entity, customerName, wizard, canView, canImport }: SubEntityImportCardProps) {
  const { t } = useTranslation(['customers', 'settings'])
  const { confirm, dialog } = useConfirm()
  const { step, file, preview, run } = wizard
  // Reuses the settings screen's own entity labels (settings:import.entities.*) —
  // one source instead of a second "Locaties/Afdelingen/Contactpersonen" copy.
  const entityLabel = t(`settings:import.entities.${entity}.label`)

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

  return (
    <div>
      <div style={cardHead}>{t('subModal.import.title', { entity: entityLabel })}</div>
      <div style={{ ...cardBox, gap: 10 }}>

        {/* Idle: the honest pitch — this WRITES, it does not prefill the form below —
            plus the exact matching rule (reused verbatim from the settings wizard's
            own per-entity order hint, one source, CLAUDE.md §11) and an explicit
            warning that a different customer name in the file lands elsewhere. */}
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('subModal.import.intro', { entity: entityLabel })}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(`settings:import.order.${entity}Hint`)}</div>
            {customerName && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                {t('subModal.import.parentWarning', { customerName })}
              </div>
            )}
          </div>
        )}

        {step === 'upload' && (
          <UploadStep
            entity={entity}
            file={file}
            onSelectFile={wizard.selectFile}
            onRunPreview={wizard.runPreview}
            previewStatus={preview.status}
            previewError={preview.status === 'error' ? preview.message : undefined}
            canView={canView}
            canImport={canImport}
          />
        )}

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
      </div>
      {dialog}
    </div>
  )
}
