// appointment_create module — plan a scheduled Appointment from a workflow step
// (K0-A / KOIOS-SLIM O-18), the missing "afspraak/intake plannen" sibling of
// task_create so the Koios AI action layer can act on a candidate's calendar too
// (§3B: appointments are the structured entity intake reporting relies on).
// Field keys mirror App\Workflow\Modules\AppointmentCreateModule::configSchema()
// exactly.
import { CalendarPlus } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'appointment_create',
  category: 'Kandidaten',
  label: 'Afspraak/intake plannen',
  Icon:  CalendarPlus,
  color: 'var(--module-teal-strong)',
  bg:    tintBg('var(--module-teal-strong)'),
  schema: [
    { key: 'title', label: 'Titel', type: 'text' },
    // Free text (Carbon::parse on the backend) so it also accepts a variable —
    // never a native date input, which would drop both the time and the token.
    { key: 'start', label: 'Starttijd', type: 'text',
      hint: 'Datum en tijd (bv. 10-08-2026 14:00) of een variabele.' },
    { key: 'candidate_id', label: 'Kandidaat', type: 'text', placeholder: '{{trigger.candidate_id}}' },
    { key: 'location', label: 'Locatie', type: 'text' },
    { key: 'notes', label: 'Notities', type: 'textarea' },
  ],
}
