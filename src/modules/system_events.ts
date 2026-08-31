// system_events module — the SYSTEM departure (Danny 31-08: systeemmeldingen
// zonder masterdata-subject "JA"). One event-select drives which system signal
// starts the run; the engine validates the run really came from that event and
// normalises an ids-only payload (CMBE design, lockstep — the picker's catalog
// gate hides this tile until the engine registers the type). Vocabulary is
// extensible server-side; the two WhatsApp health signals are the seed set.
import { BellRing } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'system_events',
  category: 'Triggers',
  label:    'Systeemgebeurtenis',
  Icon:     BellRing,
  color:    'var(--module-warmgrey)',
  bg:       tint('var(--module-warmgrey)', 16),
  // VERTREKMODULE-1: sanctioned system departure (Danny's JA, 31-08).
  isStart:  true,
  schema: [
    { key: 'event', label: 'Gebeurtenis', type: 'select', required: true, default: 'whatsapp.connection_down',
      options: [
        { value: 'whatsapp.connection_down', label: 'WhatsApp-storing' },
        { value: 'whatsapp.connection_restored', label: 'WhatsApp hersteld' },
      ] },
  ],
}
