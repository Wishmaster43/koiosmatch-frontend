// message_lookup module — look up outbound-message status per candidate/category
// (e.g. did the shifts_offered WhatsApp get a reply? feeds no-reaction flows).
import { MessageCircle } from 'lucide-react'

export default {
  type:  'message_lookup',
  app:   'core',
  category: 'Communicatie',
  label: 'Berichtstatus',
  Icon:  MessageCircle,
  color: '#16A34A',
  bg:    '#EAF7EE',
  schema: [
    { key: 'message_category', label: 'Berichtcategorie', type: 'text', placeholder: 'shifts_offered' },
  ],
}
