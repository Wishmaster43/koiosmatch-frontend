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
  // Own tint % — kept distinct from --color-violet-bg (shared by the AI/parser modules) so the Vacatures entity stays visually distinguishable.
  bg:       'color-mix(in srgb, var(--color-violet) 10%, transparent)',
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
