/**
 * useCustomerImport — owns the import wizard instance, the customers.view /
 * customers.create permission checks, and the auto-close-on-success effect for
 * CustomerImportCard. Extracted into its own hook (rather than inlined in
 * AddCustomerModal) purely to keep the container under the ~400-line split
 * trigger (CLAUDE.md §3) — the wizard STATE itself still lives in the container's
 * render tree via this hook call, exactly like useCvParse is owned by
 * AddCandidateModal rather than by CvUploadCard.
 */
import { useEffect } from 'react'
import { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'

// The ONE backend importer that builds a whole customer tree (customer + locations +
// departments + contacts) from one flat file — verified against koiosmatch-api's
// ImportRegistry::IMPORTERS ('customer_tree' => CustomerTreeImporter::class), never
// guessed from the entity's display name.
export const CUSTOMER_TREE_ENTITY = 'customer_tree'

interface UseCustomerImportArgs {
  hasPermission: (permName: string) => boolean
  /** Called once a real import lands at least one record. */
  onImported?: () => void
  onClose: () => void
}

export function useCustomerImport({ hasPermission, onImported, onClose }: UseCustomerImportArgs) {
  const wizard = useImportWizard(CUSTOMER_TREE_ENTITY)
  // GET /imports/{entity}/template.csv needs customers.view; the dry-run AND the
  // real run both need customers.create — an import is a bulk create.
  const canView = hasPermission('customers.view')
  const canImport = hasPermission('customers.create')

  // CUSTOMER-IMPORT-1 (Danny 02-08): a real run that landed at least one row means
  // the customer already exists — close the modal (and let the parent refresh its
  // list) so the untouched manual form can never also fire a second, duplicate
  // create. A run that landed NOTHING (every row skipped/errored) stays open
  // instead, so CustomerImportCard's ResultStep can explain why.
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
