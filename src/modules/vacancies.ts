// vacancies module — the per-entity Vacatures module (fetch + filter inline, plus
// create/update).
import { Briefcase } from 'lucide-react'
import makeEntityModule from './_entityModule'
import { tintBg } from '@/lib/tint'

export default makeEntityModule({
  type:     'vacancies',
  label:    'Vacatures',
  category: 'Vacatures',
  Icon:     Briefcase,
  color:    'var(--color-violet)',
  // House tint (lib/tint, 10%) — distinct from --color-violet-bg (the AI/parser
  // modules) so the Vacatures entity stays visually distinguishable.
  bg:       tintBg('var(--color-violet)'),
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'customer', label: 'Klant' },
    { value: 'function', label: 'Functie' },
    // NODE-SYNC-1 (22-08, nameting): 'location' is GEEN backing field — de BE
    // nult hem expliciet (backend VacanciesModule nults it: "HAS NO BACKING FIELD"), dus de
    // optie beloofde filtering die nooit gebeurde. De echte drilldown-filters
    // (customer_location_id/afdeling) komen met de herstelronde als pickers.
    { value: 'owner',    label: 'Eigenaar / recruiter' },
  ],
  sortOptions: [
    { value: 'title',      label: 'Titel' },
    { value: 'created_at', label: 'Aangemaakt' },
    { value: 'status',     label: 'Status' },
  ],
})
