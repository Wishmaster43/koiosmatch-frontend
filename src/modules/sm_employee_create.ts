// sm_employee_create module (SM-CREATE-1) — the WRITE counterpart of
// sm_employee_update: POST a new employee to Shiftmanager for every pipeline
// candidate not yet linked, then stamp the returned id onto the candidate's
// ExternalIdMapping. Dry-run defaults ON (blast-radius containment, mirrors
// sm_employee_update) — a first run only REPORTS who would be created.
// Gating mirrors sm_employee_update exactly: the connector app OR the sm module
// (CONNECTOR-VS-REPORTING-1), the same predicate the backend's WorkflowWriter
// checks for both write-back steps. Field keys mirror
// App\Workflow\Modules\SmEmployeeCreateModule::configSchema()
// (SmSyncBaseModule::configSchema() + dry_run) exactly.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { tintBg } from '@/lib/tint'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

export default {
  type:  'sm_employee_create',
  // CONNECTOR-VS-REPORTING-1 (Danny 19-11): a connector WRITE step. The picker offers it on the
  // connector app OR the module (either signal) and the BE WorkflowWriter checks the same connector
  // predicate, so the reporting add-on alone never gates it (BE CONNECTOR-VS-REPORTING-BE-1).
  module: 'sm',
  app:   'shiftmanager',
  category: 'shiftmanager',
  label: 'Create SM employee',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    tintBg('var(--module-shiftmanager)'),
  schema: [
    SM_CONNECTION_FIELD,
    { key: 'dry_run', label: 'Dry run', type: 'boolean', default: true,
      help: 'Dry-run first: reports WHO would be created (incl. payload), writes nothing. Turn off explicitly to really create in Shiftmanager.' },
    smLimitField(500),
  ],
}
