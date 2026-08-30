// whatsapp_inbound module — the inbound-webhook DEPARTURE node (Danny 31-08,
// Appendix H: "workflow inkomend 1 is webhook of workflow 2 inkomend is
// whatsapp web"). Schema mirrors CMBE's served configSchema (31-08): ONE
// two-lane `source` select — meta (WABA + Coexistence share one webhook) or
// wa_web. The waba/waba_coex/wa_web channel trio lives on the whatsapp_send
// node (KANAAL-NAAR-SEND-1), never here. Wrong lane resolves as an honest
// skip on the step output; a manual run without inbound payload is a step error.
import { Webhook } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'whatsapp_inbound',
  category: 'Triggers',
  label:    'WhatsApp Inkomend',
  Icon:     Webhook,
  color:    'var(--module-green)',
  bg:       tint('var(--module-green)', 9),
  // VERTREKMODULE-1: a valid point of origin (also listed in START_MODULE_TYPES).
  isStart:  true,
  schema: [
    { key: 'source', label: 'Bron', type: 'select', required: true, default: 'meta',
      options: ['meta', 'wa_web'] },
  ],
}
