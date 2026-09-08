// calendar_invite module — creates a real calendar event with a Meet/Teams
// conference link for an Appointment. Uses the tenant's already-connected OAuth
// mailbox. Writes the link back onto the appointment (meeting_url) so the FE
// drawer can read it, and outputs the field for a downstream send step.
// Mirrors the appointment_create module's structure (teal tokens, Kandidaten category).
import { Video } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'calendar_invite',
  category: 'Planning',
  label: 'Agenda-uitnodiging (Google Meet)',
  Icon:  Video,
  color: 'var(--module-teal-strong)',
  bg:    tintBg('var(--module-teal-strong)'),
  schema: [
    { key: 'appointment_id', label: 'Afspraak', type: 'text',
      hint: 'Afspraak-id (bv. {{trigger.appointment_id}}).' },
    { key: 'title', label: 'Titel', type: 'text',
      hint: 'Titel van de agenda-afspraak (standaard "Afspraak").' },
  ],
}
