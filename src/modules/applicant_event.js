// applicant_event module — trigger: run the workflow when an application event fires
// (e.g. 'afgewezen' with a reason). "direct" runs immediately on the incoming event;
// "in wachtrij" queues it (rate-limited). The backend emits the event + payload and
// the available tokens (see worklist C-32).
import { Zap } from 'lucide-react'

export default {
  type:  'applicant_event',
  category: 'Triggers',
  label: 'Sollicitatie-event',
  Icon:  Zap,
  color: '#0369A1',
  bg:    'var(--color-info-bg)',
  schema: [
    { key: 'event',            label: 'Gebeurtenis',          type: 'select', options: ['afgewezen', 'aangenomen', 'nieuwe sollicitatie', 'fase gewijzigd'] },
    { key: 'rejection_reason', label: 'Afwijsreden (filter)', type: 'text',   placeholder: 'optioneel — leeg = alle redenen' },
    { key: 'run_mode',         label: 'Uitvoeren',            type: 'select', options: ['direct', 'in wachtrij'] },
  ],
}
