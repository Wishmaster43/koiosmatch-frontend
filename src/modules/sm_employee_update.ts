// sm_employee_update module — write an employee status back to ShiftManager.
// dry_run defaults ON so a first run only REPORTS what would change (safe rehearse).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_employee_update',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'SM status bijwerken',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    // BE whitelist for the target status (contract 2026-07-09; being widened BE-side).
    { key: 'target_status', label: 'Nieuwe status', type: 'select',
      options: ['actief', 'nietactief', 'nieuw', 'uitgeschreven', 'verwijderd', 'extern'] },
    { key: 'dry_run', label: 'Proefdraaien (dry-run)', type: 'boolean', default: true,
      help: 'Eerst proefdraaien — rapporteert wat er ZOU wijzigen zonder iets te schrijven.' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 10000, placeholder: '10000' },
  ],
}
