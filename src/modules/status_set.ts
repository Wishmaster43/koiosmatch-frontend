// status_set module — set a candidate's status from the workflow (native ATS step).
// Field keys mirror App\Workflow\Modules\StatusSetModule::configSchema() exactly
// (WF-BUILDER-VELDEN-1 added reason). `effective_from` was declared by the engine's
// configSchema but never read by execute() (Opus-measured); backend-Claude then
// REMOVED it from the schema (23-08) — "later laten ingaan" is a Wachten-step in
// front of this one. `reason` now lands on candidates.status_reason server-side.
import { UserCheck } from 'lucide-react'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'

export default {
  type:  'status_set',
  category: 'Kandidaten',
  label: 'Status zetten',
  Icon:  UserCheck,
  color: 'var(--module-teal-strong)',
  bg:    tint('var(--module-teal-strong)', 4),
  schema: [
    // Candidate statuses are served ONLY inside GET /settings/candidate-lookups
    // (an object of four collections) — no flat /candidate-statuses route exists;
    // the old endpoint 404'd into an empty picker (Opus-measured).
    { key: 'status', label: 'Nieuwe status', type: 'lookup_select', endpoint: '/settings/candidate-lookups', responseKey: 'statuses' },
    // Lands on candidates.status_reason (the drawer shows it) AND in the audit
    // trail (StatusSetModule::execute, backend 23-08).
    { key: 'reason', label: 'Reden', type: 'text' },
    // Return date for deployability statuses that support it (Unavailable/Sick/Leave).
    // Lands on candidates.status_return_date server-side.
    { key: 'return_date', label: 'Weer beschikbaar vanaf', type: 'date', help: 'Alleen voor Niet beschikbaar, Ziek en Verlof.' },
    // Blacklist reason: lookup-backed dropdown from /candidate-blacklist-reasons.
    // Lands on candidates.blacklist_reason; required when status is Blacklist.
    { key: 'blacklist_reason', label: 'Blacklist-reden', type: 'lookup_select', endpoint: '/candidate-blacklist-reasons', help: 'Verplicht wanneer de status Blacklist is.' },
  ],
}
