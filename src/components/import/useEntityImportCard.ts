/**
 * useEntityImportCard — owns the import wizard instance, the view/create
 * permission checks and the auto-close-on-success effect behind EntityImportCard.
 * Extracted into its own hook (rather than inlined in the create modal) purely to
 * keep the container under the ~400-line split trigger (CLAUDE.md §3) — the wizard
 * STATE itself still lives in the container's render tree via this hook call,
 * exactly like useCvParse is owned by AddCandidateModal rather than by CvUploadCard.
 *
 * GENERALISED (2026-08-14, EXCEL-VACATURES-1): this used to be customer-only
 * (`useCustomerImport`, hardcoded to `customers.view`/`customers.create`). The
 * permission pair is now resolved from the SELECTED entity via
 * `importPermissionsFor` (settings/sections/importeren/importTemplateShape) — the
 * same source the full-screen import wizard already uses — so a vacancy caller
 * correctly gates on vacancies.view/vacancies.create instead of the customers pair.
 */
import { useEffect } from 'react'
import { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
import { importPermissionsFor } from '@/pages/settings/sections/importeren/importTemplateShape'

interface UseEntityImportCardArgs {
  /** The backend importer key (ImportRegistry::IMPORTERS), e.g. 'customer_tree' or 'vacancies'. */
  entity: string
  hasPermission: (permName: string) => boolean
  /** Called once a real import lands at least one record. */
  onImported?: () => void
  onClose: () => void
}

export function useEntityImportCard({ entity, hasPermission, onImported, onClose }: UseEntityImportCardArgs) {
  const wizard = useImportWizard(entity)
  // GET /imports/{entity}/template.csv needs the entity's own view right; the
  // dry-run AND the real run both need its create right — an import is a bulk create.
  const { view, create } = importPermissionsFor(entity)
  const canView = hasPermission(view)
  const canImport = hasPermission(create)

  // A real run that landed at least one row means the record(s) already exist —
  // close the modal (and let the parent refresh its list) so the untouched manual
  // form can never also fire a second, duplicate create. A run that landed
  // NOTHING (every row skipped/errored) stays open instead, so the card's
  // ResultStep can explain why.
  useEffect(() => {
    if (wizard.run.status !== 'success') return
    const { summary } = wizard.run.result
    if (summary.create + summary.update === 0) return
    onImported?.()
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the run RESULT changing, not onClose/onImported identity
  }, [wizard.run])

  return { wizard, canView, canImport }
}
