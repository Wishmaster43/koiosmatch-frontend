// interview_start module — the AI-recruiter step (WF-APP-CREATED-AI-1). Hands off
// entirely to the live AI-interview mechanism (InterviewEngine::startForApplication)
// for the run's own application_id; every engine guard (no mobile, no consent, a
// terminal funnel stage, an already open session) resolves as an honest skip on the
// step's output, never a config choice here — mirror App\Workflow\Modules\
// InterviewStartModule::configSchema(), which returns [] on purpose: this step always
// acts on the trigger's own application, so there is truly nothing to configure.
import { BotMessageSquare } from 'lucide-react'

export default {
  type:     'interview_start',
  category: 'AI',
  label:    'AI-interview starten',
  Icon:     BotMessageSquare,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  // No config fields — ConfigPanel shows the "no configuration" empty state,
  // which is honest here (the backend schema is genuinely empty), not a gap.
  schema: [],
}
