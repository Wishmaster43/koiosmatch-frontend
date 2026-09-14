// match_application_lookup module — the engine's sibling of application_lookup for
// scenarios that START from a match (Match verbroken / loopt af / check-in): it
// resolves the application behind the run's match so the AI agent and the send
// step downstream address the right applicant. configSchema is [] BY CONTRACT
// (BE catalogue 14-09: schema [], emits append): resolution is deterministic, so
// there is nothing to configure; outputs carry lookup_status / lookup_skip_reason /
// application_id / candidate_id. Added because three seeded yesway scenarios carried
// the type while the FE registry lacked a card and the canvas showed "Onbekende module".
import { SearchCheck } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'match_application_lookup',
  category: 'Sollicitaties',
  label:    'Sollicitatie via match ophalen',
  Icon:     SearchCheck,
  color:    'var(--color-map)',
  bg:       tint('var(--color-map)', 9),
  schema: [],
}
