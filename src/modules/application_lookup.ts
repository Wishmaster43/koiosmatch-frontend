// application_lookup module — second node of the inbound chain (Danny 31-08,
// Appendix H: "op basis van het nummer wordt de juiste sollicitant gezocht en
// de status van het interview"). configSchema is {} BY CONTRACT (CMBE 31-08):
// resolution is deterministic — an open interview session wins, else the
// newest application — so there is nothing to configure; outputs carry
// lookup_status/application_id/interview_session_id/intake_status.
import { SearchCheck } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'application_lookup',
  category: 'Sollicitaties',
  label:    'Sollicitatie opzoeken',
  Icon:     SearchCheck,
  color:    'var(--color-map)',
  bg:       tint('var(--color-map)', 9),
  schema: [],
}
