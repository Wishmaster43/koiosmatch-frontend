// applications module — the per-entity Sollicitaties module (fetch + filter inline,
// plus create/update). Replaces applicants_fetch + applicant_filter.
import { ClipboardList } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'applications',
  label:    'Sollicitaties',
  category: 'Sollicitaties',
  Icon:     ClipboardList,
  color:    '#2563EB',
  bg:       '#E6EEFE',
  filterFields: [
    { value: 'funnel_stage',     label: 'Funnelfase' },
    { value: 'rejection_reason', label: 'Afwijsreden' },
    { value: 'vacancy',          label: 'Vacature' },
    { value: 'candidate',        label: 'Kandidaat' },
    { value: 'days_in_stage',    label: 'Dagen in fase' },
    { value: 'owner',            label: 'Eigenaar / recruiter' },
  ],
  sortOptions: [
    { value: 'created_at',   label: 'Datum' },
    { value: 'name',         label: 'Naam' },
    { value: 'funnel_stage', label: 'Funnelfase' },
  ],
})
