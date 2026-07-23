// backoffice_sync module — couple the pipeline's candidates (or another entity from the
// trigger context) to a backoffice: HelloFlex or ShiftManager. One module, the system is
// config; the seeded single/bulk koppel-scenarios in the Kandidaten folder use it
// (BACKOFFICE-SCENARIO-1). only_unlinked guards bulk runs against re-queueing records
// that already carry a linked external id in the mappings table (no doubles — Danny).
import { Link2 } from 'lucide-react'

export default {
  type:     'backoffice_sync',
  label:    'Backoffice koppelen',
  category: 'Kandidaten',
  Icon:     Link2,
  color:    '#0E7490',
  bg:       '#E0F2FE',
  // Visible when EITHER connector app is on (MODULE_APP_MAP is any-of).
  app:      ['hf', 'shiftmanager'],
  schema: [
    { key: 'system', label: 'Systeem', type: 'select', options: ['helloflex', 'shiftmanager'] },
    { key: 'include_children', label: 'Inclusief onderliggende locaties/afdelingen/contacten', type: 'boolean', help: 'Alleen relevant wanneer de gekoppelde entiteit een klant is.' },
    { key: 'only_unlinked', label: 'Alleen nog niet gekoppelde', type: 'boolean', help: 'Sla records over die al een koppeling met dit systeem hebben — aan te raden bij bulk.' },
  ],
}
