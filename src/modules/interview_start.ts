// interview_start module — the AI-recruiter step (WF-APP-CREATED-AI-1). Hands off
// entirely to the live AI-interview mechanism (InterviewEngine::startForApplication)
// for the run's own application_id; every engine guard (no mobile, no consent, a
// terminal funnel stage, an already open session) resolves as an honest skip on the
// step's output, never a config choice here — mirrors App\Workflow\Modules\
// InterviewStartModule::configSchema(). STALE-FIXED 28-08: that schema was measured
// as [] on 2026-07-xx and this file copied that; the backend module now carries
// `interview_flow_id` (CMBE contract, WF-INTERVIEW-FLOW-1) — an optional override of
// which flow runs this step, resolved engine-side application → vacancy → agent when left blank.
import { BotMessageSquare } from 'lucide-react'

export default {
  type:     'interview_start',
  category: 'AI',
  label:    'AI-interview starten',
  Icon:     BotMessageSquare,
  color:    'var(--color-violet)',
  bg:       'var(--color-violet-bg)',
  schema: [
    // Options come from GET /ai/interview-flows (tenant lookup, §10 — never a
    // hardcoded list). Clearable (VAC-CLEAR-1): leaving it blank is a real,
    // supported choice, not a missing pick — the engine then resolves the flow
    // from the application, then the vacancy, then the agent default.
    {
      key: 'interview_flow_id',
      label: 'Interviewflow',
      type: 'lookup_select',
      endpoint: '/ai/interview-flows',
      placeholder: 'Standaard van de vacature/sollicitatie',
    },
  ],
}
