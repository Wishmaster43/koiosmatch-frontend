// vacancies module — the per-entity Vacatures module (fetch + filter inline, plus
// create/update).
import { Briefcase } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'vacancies',
  label:    'Vacatures',
  category: 'Vacatures',
  Icon:     Briefcase,
  color:    '#7C3AED',
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
