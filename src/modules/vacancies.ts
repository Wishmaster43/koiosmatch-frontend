// vacancies module — the per-entity Vacatures module (fetch + filter inline, plus
// create/update).
import { Briefcase } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'vacancies',
  label:    'Vacatures',
  category: 'Vacatures',
  Icon:     Briefcase,
  color:    'var(--color-violet)',
  // eslint-disable-next-line no-restricted-syntax -- module-palette tint, kept distinct from --color-violet-bg (shared by the AI/parser modules) so the Vacatures entity stays visually distinguishable
  bg:       '#F1EBFD',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'customer', label: 'Klant' },
    { value: 'function', label: 'Functie' },
    { value: 'location', label: 'Locatie' },
    { value: 'owner',    label: 'Eigenaar / recruiter' },
  ],
  sortOptions: [
    { value: 'title',      label: 'Titel' },
    { value: 'created_at', label: 'Aangemaakt' },
    { value: 'status',     label: 'Status' },
  ],
})
