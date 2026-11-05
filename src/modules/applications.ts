// applications module — the per-entity Sollicitaties module (fetch + filter inline,
// plus create/update). Replaces applicants_fetch + applicant_filter.
import { ClipboardList } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'applications',
  label:    'Applications',
  category: 'applications',
  Icon:     ClipboardList,
  color:    'var(--color-map)',
  bg:       'color-mix(in srgb, var(--color-map) 9%, transparent)',
  filterFields: [
    { value: 'funnel_stage',     label: 'Funnel stage' },
    { value: 'rejection_reason', label: 'Rejection reason' },
    { value: 'vacancy',          label: 'Vacancy' },
    { value: 'candidate',        label: 'Candidate' },
    { value: 'days_in_stage',    label: 'Days in stage' },
    { value: 'owner',            label: 'Owner / recruiter' },
  ],
  sortOptions: [
    { value: 'created_at',   label: 'Date' },
    { value: 'name',         label: 'Name' },
    { value: 'funnel_stage', label: 'Funnel stage' },
  ],
})
