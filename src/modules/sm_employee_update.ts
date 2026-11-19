// sm_employee_update module — write an employee status back to Shiftmanager.
// dry_run defaults ON so a first run only REPORTS what would change (safe rehearse).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

export default {
  type:  'sm_employee_update',
  // CONNECTOR-VS-REPORTING-1 (Danny 19-11): a connector WRITE step. The picker offers it on the
  // connector app OR the module (either signal) and the BE WorkflowWriter checks the same connector
  // predicate, so the reporting add-on alone never gates it (BE CONNECTOR-VS-REPORTING-BE-1).
  module: 'sm',
  app:   'shiftmanager',
  category: 'shiftmanager',
  label: 'Update SM status',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    SM_CONNECTION_FIELD,
    // BE whitelist for the target status (contract 2026-07-09; being widened BE-side).
    { key: 'target_status', label: 'New status', type: 'select',
      options: ['actief', 'nietactief', 'nieuw', 'uitgeschreven', 'verwijderd', 'extern'] },
    { key: 'dry_run', label: 'Dry run', type: 'boolean', default: true,
      help: 'Dry-run first. Reports what WOULD change without writing anything.' },
    smLimitField(10000),
  ],
}
