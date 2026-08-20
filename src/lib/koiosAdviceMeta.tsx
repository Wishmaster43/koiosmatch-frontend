import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Target, Phone, CalendarPlus, Sparkles, AlertTriangle, RefreshCw, Clock, ClipboardList } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'

type LucideIcon = ComponentType<{ size?: number; style?: CSSProperties }>

interface AdviceMeta { icon: LucideIcon; color: string }

// Icon + colour per Koios advice action — shared by every entity table's "Koios"
// column (Danny 05-08: candidates, applications, vacancies, matches, opportunities,
// tasks, outreach, customers all render this ONE identity). Colours are the
// existing §4 semantic tokens (SoftChip's color-mix works for both hex and
// CSS-var tokens):
//   add_to_pool --color-primary · contact/attention --color-warning
//   plan_intake/follow_up --color-map · renew --color-info · overdue --color-danger
//   task --text-muted (applications' free-text advice: the kind of task is unknown,
//   so the colour stays neutral while the clipboard glyph says "suggested task")
//   default --text-muted
export const ADVICE_META: Record<string, AdviceMeta> = {
  add_to_pool: { icon: Target,       color: 'var(--color-primary-text)' },
  contact:     { icon: Phone,        color: 'var(--color-warning)' },
  plan_intake: { icon: CalendarPlus, color: 'var(--color-map)' },
  // Customers + opportunities: a stalled relationship needs a scheduled follow-up.
  follow_up:   { icon: CalendarPlus, color: 'var(--color-map)' },
  // Vacancies + outreach: something needs a human look (stale/misconfigured), not
  // yet urgent enough for the danger colour.
  attention:   { icon: AlertTriangle, color: 'var(--color-warning)' },
  // Matches: the contract end date is approaching or passed while still open.
  renew:       { icon: RefreshCw,     color: 'var(--color-info)' },
  // Tasks: past its due date — mirrors the due-column's own overdue colour.
  overdue:     { icon: Clock,         color: 'var(--color-danger-text)' },
  // Applications: the backend's free-text suggested next action (useApplicationAdvice).
  task:        { icon: ClipboardList, color: 'var(--text-muted)' },
  default:     { icon: Sparkles,     color: 'var(--text-muted)' },
}

// `source` tags WHO produced this advice ('rules' = the FE engine, or a future
// backend engine's own tag) — the honest gate in useCandidateAdvice reads it.
export interface KoiosAdvice { action?: string | null; label?: string | null; reason?: string | null; source?: string }

const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

/**
 * KoiosAdvicePill — the one "Koios" column cell renderer: a dash when there is
 * no advice, plain text when the tenant's colour setting is off, otherwise the
 * shared soft-chip pill with the advice's icon. `fallbackLabel` lets a caller
 * resolve an i18n label when the backend didn't already send one (candidates);
 * customers' advice always arrives pre-labelled, so it can omit it.
 */
export function KoiosAdvicePill({ advice, colored, fallbackLabel }: {
  advice?: KoiosAdvice | null
  colored: boolean
  fallbackLabel?: (action: string) => string
}): ReactNode {
  if (!advice || !advice.action || advice.action === 'none') return dash
  const label = advice.label || fallbackLabel?.(advice.action) || advice.action
  if (!colored) return <span style={plainCell} title={advice.reason || undefined}>{label}</span>
  const meta = ADVICE_META[advice.action] ?? ADVICE_META.default
  const Icon = meta.icon
  return <SoftChip title={advice.reason || undefined} color={meta.color} round label={<><Icon size={12} />{label}</>} />
}
