// message_lookup module — look up outbound-message status per candidate/category
// (e.g. did the shifts_offered WhatsApp get a reply? feeds no-reaction flows).
import { MessageCircle } from 'lucide-react'

export default {
  type:  'message_lookup',
  category: 'Communicatie',
  label: 'Berichtstatus',
  Icon:  MessageCircle,
  color: 'var(--color-success)',
  // eslint-disable-next-line no-restricted-syntax -- module-palette tint, no matching --color-success-bg hue close enough; tracked as a token-set follow-up
  bg:    '#EAF7EE',
  schema: [
    { key: 'message_category', label: 'Berichtcategorie', type: 'text', placeholder: 'shifts_offered' },
  ],
}
