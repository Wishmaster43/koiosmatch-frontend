// message_lookup module — look up outbound-message status per candidate/category
// (e.g. did the shifts_offered WhatsApp get a reply? feeds no-reaction flows).
import { MessageCircle } from 'lucide-react'

export default {
  type:  'message_lookup',
  category: 'Communicatie',
  label: 'Berichtstatus',
  Icon:  MessageCircle,
  color: 'var(--color-success)',
  // Own tint % (lighter than --color-success-bg) so the module keeps its own soft-green swatch.
  bg:    'color-mix(in srgb, var(--color-success) 9%, transparent)',
  schema: [
    { key: 'message_category', label: 'Berichtcategorie', type: 'text', placeholder: 'shifts_offered' },
  ],
}
