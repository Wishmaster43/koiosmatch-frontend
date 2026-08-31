// outreach_campaigns module — vertrekmodule (ENTITY-MODULES-ONTBREKEND-1, Danny's §10
// subjectlijst; CMBE-vocab definitief 31-08). Fetch-only: the engine's thin
// module carries Ophalen only, so no create/update actions here (§3 — no fake
// affordances). The model IS OutreachCampaign — type-key follows it (no separate call_lists).
import { PhoneCall } from 'lucide-react'
import { tint } from '@/lib/tint'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'outreach_campaigns',
  label:    'Bellijsten',
  category: 'Bellijsten',
  Icon:     PhoneCall,
  color:    'var(--module-purple)',
  bg:       tint('var(--module-purple)', 16),
  actions:  ['Ophalen'],
  filterFields: [
    { value: 'status', label: 'Status' },
    { value: 'channel', label: 'Kanaal' },
    { value: 'owner', label: 'Eigenaar' },
  ],
  sortOptions: [
    { value: 'name', label: 'Naam' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
