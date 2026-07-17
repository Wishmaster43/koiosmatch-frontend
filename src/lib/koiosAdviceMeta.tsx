import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Target, Phone, CalendarPlus, Sparkles } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'

type LucideIcon = ComponentType<{ size?: number; style?: CSSProperties }>

interface AdviceMeta { icon: LucideIcon; color: string }

// Icon + colour per Koios advice action — shared by every entity table's "Koios"
// column (was duplicated near-verbatim in CandidatesTable and CustomersTable).
// Colours are the existing §4 semantic tokens (SoftChip's color-mix works for
// both hex and CSS-var tokens, so tokenizing here costs nothing over the old
// hardcoded hex — this is exactly the ADVICE_META values converted 1:1):
//   add_to_pool #19A5CA === --color-primary · contact #D97706 === --color-warning
//   plan_intake #2563EB === --color-map      · default #6B7280 === --text-muted
export const ADVICE_META: Record<string, AdviceMeta> = {
  add_to_pool: { icon: Target,       color: 'var(--color-primary)' },
  contact:     { icon: Phone,        color: 'var(--color-warning)' },
  plan_intake: { icon: CalendarPlus, color: 'var(--color-map)' },
  // Customers-only action slug — same visual family as plan_intake (a scheduled follow-up).
  follow_up:   { icon: CalendarPlus, color: 'var(--color-map)' },
  default:     { icon: Sparkles,     color: 'var(--text-muted)' },
}

export interface KoiosAdvice { action?: string | null; label?: string | null; reason?: string | null }

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
