// sm_employee_create module (SM-CREATE-1) — the WRITE counterpart of
// sm_employee_update: POST a new employee to Shiftmanager for every pipeline
// candidate not yet linked, then stamp the returned id onto the candidate's
// ExternalIdMapping. Dry-run defaults ON (blast-radius containment, mirrors
// sm_employee_update) — a first run only REPORTS who would be created.
// Gating mirrors sm_employee_update exactly: a connector-app requirement
// (MODULE_APP_MAP), not a package module — the backend gates both write-back
// steps identically via WorkflowWriter::MODULE_CONNECTORS, never
// MODULE_REQUIRES. Field keys mirror
// App\Workflow\Modules\SmEmployeeCreateModule::configSchema()
// (SmSyncBaseModule::configSchema() + dry_run) exactly.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { tintBg } from '@/lib/tint'

export default {
  type:  'sm_employee_create',
  app:   'shiftmanager',
  category: 'Shiftmanager',
  label: 'SM medewerker aanmaken',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    tintBg('var(--module-shiftmanager)'),
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'dry_run', label: 'Proefdraaien (dry-run)', type: 'boolean', default: true,
      help: 'Eerst proefdraaien: rapporteert WIE er aangemaakt zou worden (incl. payload), schrijft niets. Zet expliciet uit om echt in Shiftmanager aan te maken.' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 500, placeholder: '500' },
  ],
}
