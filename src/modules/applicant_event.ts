// applicant_event module — trigger: run the workflow when an application event fires
// (e.g. 'afgewezen' with a reason). "direct" runs immediately on the incoming event;
// "in wachtrij" queues it (rate-limited). The backend emits the event + payload and
// the available tokens (see worklist C-32).
import { Zap } from 'lucide-react'

export default {
  type:  'applicant_event',
  category: 'triggers',
  label: 'Applicant event',
  Icon:  Zap,
  color: 'var(--module-info)',
  bg:    'var(--color-info-bg)',
  schema: [
    { key: 'event',            label: 'Event',          type: 'select', options: ['afgewezen', 'aangenomen', 'nieuwe sollicitatie', 'fase gewijzigd'] },
    { key: 'rejection_reason', label: 'Rejection reason (filter)', type: 'text',   placeholder: 'optional. Empty = all reasons' },
    { key: 'run_mode',         label: 'Run',            type: 'select', options: ['direct', 'in wachtrij'] },
  ],
}
