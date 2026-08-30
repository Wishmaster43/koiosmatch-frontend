// whatsapp_inbound module — the inbound-webhook DEPARTURE node (Danny 31-08,
// Appendix H: "workflow inkomend 1 is webhook of workflow 2 inkomend is
// whatsapp web"). Registered FE-side so the reseeded inbound workflows render
// their real name instead of "Onbekende module"; the config schema follows
// CMBE's contract (channel choice waba/waba_coex/wa_web) — not guessed here.
import { Webhook } from 'lucide-react'

export default {
  type:     'whatsapp_inbound',
  category: 'Triggers',
  label:    'WhatsApp Inkomend',
  Icon:     Webhook,
  color:    'var(--color-success)',
  bg:       'color-mix(in srgb, var(--color-success) 9%, transparent)',
  // VERTREKMODULE-1: a valid point of origin (also listed in START_MODULE_TYPES).
  isStart:  true,
  // Schema lands with CMBE's contract (channel source choice); empty = an
  // honest bare panel until then, never invented fields (§3).
  schema: [],
}
