// sm_employee_update module — write an employee status back to Shiftmanager.
// dry_run defaults ON so a first run only REPORTS what would change (safe rehearse).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

export default {
  type:  'sm_employee_update',
  // SM-WRITE-GATE-1 (api d36a4406, WorkflowWriter::MODULE_REQUIRES): saving a workflow with this
  // step 422s for a tenant without the sm package — the picker shows it as "requires Shiftmanager".
  module: 'sm',
  app:   'shiftmanager',
  category: 'Shiftmanager',
  label: 'SM status bijwerken',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    SM_CONNECTION_FIELD,
    // BE whitelist for the target status (contract 2026-07-09; being widened BE-side).
    { key: 'target_status', label: 'Nieuwe status', type: 'select',
      options: ['actief', 'nietactief', 'nieuw', 'uitgeschreven', 'verwijderd', 'extern'] },
    { key: 'dry_run', label: 'Proefdraaien (dry-run)', type: 'boolean', default: true,
      help: 'Eerst proefdraaien — rapporteert wat er ZOU wijzigen zonder iets te schrijven.' },
    smLimitField(10000),
  ],
}
