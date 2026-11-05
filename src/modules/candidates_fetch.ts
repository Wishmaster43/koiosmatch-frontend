// candidates_fetch module — fetch OUR OWN Koios Match candidates (the native ATS
// records, never the Shiftmanager mirror) onto the pipeline, filtered on tenant-
// editable criteria (Danny 23-07: "welke soort kandidaten" — incl. contractvorm).
// Feeds the bulk scenarios: PDOK-geocode, backoffice-koppeling, bellijst, check-ins.
import { Users } from 'lucide-react'

export default {
  type:     'candidates_fetch',
  label:    'Koios Match candidates',
  category: 'candidates',
  Icon:     Users,
  color:    'var(--color-secondary)',
  bg:       'var(--color-secondary-bg)',
  schema: [
    { key: 'status',         label: 'Status (deployability)', type: 'multiselect', source: 'candidate_statuses', help: 'Empty = all statuses (blacklist is always excluded).' },
    { key: 'phase',          label: 'Phase',                   type: 'multiselect', source: 'candidate_phases',   help: 'Empty = all phases (lead / candidate / …).' },
    { key: 'candidate_types', label: 'Contract form',          type: 'multiselect', source: 'candidate_types',    help: 'E.g. only temp workers or freelancers. Empty = all contract forms.' },
    { key: 'city',           label: 'City',                 type: 'multiselect', help: 'Empty = all cities.' },
    // No placeholder here (Danny 23-07): a grey example "6" reads as a set value,
    // while an EMPTY field is the real "all candidates" state the hint describes.
    { key: 'last_contact_before_months', label: 'No contact since (months)', type: 'number', help: 'Empty = no contact filter (all candidates are included).' },
    { key: 'whatsapp_consent', label: 'Only with WhatsApp consent', type: 'boolean' },
    { key: 'limit',          label: 'Max. number',            type: 'number', help: 'Empty = safety ceiling (10,000).' },
  ],
}
