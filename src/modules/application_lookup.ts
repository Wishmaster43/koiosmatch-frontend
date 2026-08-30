// application_lookup module — second node of the inbound chain (Danny 31-08,
// Appendix H: "op basis van het nummer wordt de juiste sollicitant gezocht en
// de status van het interview"). Registered FE-side so reseeded workflows
// render the real name; config schema follows CMBE's contract — not guessed.
import { SearchCheck } from 'lucide-react'

export default {
  type:     'application_lookup',
  category: 'Sollicitaties',
  label:    'Sollicitatie opzoeken',
  Icon:     SearchCheck,
  color:    'var(--color-map)',
  bg:       'color-mix(in srgb, var(--color-map) 9%, transparent)',
  schema: [],
}
