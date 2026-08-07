// matches module — the per-entity Matches module (fetch + filter inline, plus
// create/update). A match is the continuation of a Hired application.
import { Handshake } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'matches',
  label:    'Matches',
  category: 'Matches',
  Icon:     Handshake,
  color:    'var(--module-pink)',
  bg:       'color-mix(in srgb, var(--module-pink) 10%, transparent)',
  filterFields: [
    { value: 'status',    label: 'Status' },
    { value: 'candidate', label: 'Kandidaat' },
    { value: 'vacancy',   label: 'Vacature' },
    { value: 'owner',     label: 'Eigenaar / recruiter' },
  ],
  sortOptions: [
    { value: 'created_at', label: 'Datum' },
    { value: 'status',     label: 'Status' },
  ],
})
