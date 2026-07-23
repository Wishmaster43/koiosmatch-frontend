// candidates_fetch module — fetch OUR OWN Koios Match candidates (the native ATS
// records, never the ShiftManager mirror) onto the pipeline, filtered on tenant-
// editable criteria (Danny 23-07: "welke soort kandidaten" — incl. contractvorm).
// Feeds the bulk scenarios: PDOK-geocode, backoffice-koppeling, bellijst, check-ins.
import { Users } from 'lucide-react'

export default {
  type:     'candidates_fetch',
  label:    'Koios Match kandidaten',
  category: 'Kandidaten',
  Icon:     Users,
  color:    'var(--color-secondary)',
  bg:       'var(--color-secondary-bg)',
  schema: [
    { key: 'status',         label: 'Status (inzetbaarheid)', type: 'multiselect', source: 'candidate_statuses', help: 'Leeg = alle statussen (blacklist is altijd uitgesloten).' },
    { key: 'phase',          label: 'Fase',                   type: 'multiselect', source: 'candidate_phases',   help: 'Leeg = alle fases (lead / kandidaat / …).' },
    { key: 'candidate_types', label: 'Contractvorm',          type: 'multiselect', source: 'candidate_types',    help: 'Bijv. alleen uitzendkrachten of ZZP\'ers. Leeg = alle contractvormen.' },
    { key: 'city',           label: 'Plaats',                 type: 'multiselect', help: 'Leeg = alle plaatsen.' },
    { key: 'last_contact_before_months', label: 'Geen contact sinds (maanden)', type: 'number', placeholder: '6', help: 'Leeg = geen contactfilter (alle kandidaten komen mee).' },
    { key: 'whatsapp_consent', label: 'Alleen met WhatsApp-toestemming', type: 'boolean' },
    { key: 'limit',          label: 'Max. aantal',            type: 'number', help: 'Leeg = veiligheidsplafond (10.000).' },
  ],
}
