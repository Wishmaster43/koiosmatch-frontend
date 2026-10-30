/**
 * kpiTargets — pure helpers that turn a server `kpi_targets` entry (BE KPI-TARGETS-ALERT-1)
 * into the one target line under a dashboard KPI tile. No side-effect imports on purpose.
 */
import type { KpiTarget, PerRecruiterCallsRow } from '@/types/dashboard'

export const TARGET_LINE_KINDS = ['progress', 'reached', 'over', 'within', 'monthOnly', 'monthOnlyMax'] as const
export type TargetLineKind = (typeof TARGET_LINE_KINDS)[number]
export type TargetTone = 'muted' | 'success' | 'warning'
export interface TargetLine { kind: TargetLineKind; value: number; target: number }
export interface TileTargetLine { text: string; tone: TargetTone }

// Dashboard tile id -> tenant setting key in `kpi_targets` (only these five tiles carry a target).
export const TILE_TARGET_KEY: Record<string, string> = {
  candidatesNew: 'new_candidates_target',
  placements: 'placements_target',
  fillRate: 'fill_rate_target',
  tasks: 'open_tasks_target',
  uncalledCallist: 'uncalled_warning_threshold',
}

// Tile percentages: the target is a 0..100 value for the fill-rate tile only.
export const PERCENT_TILES = new Set(['fillRate'])

// Tone per kind: only reached (green) and over-maximum (orange) are coloured; progress is never an alarm (M1).
const TONE: Record<TargetLineKind, TargetTone> = { progress: 'muted', reached: 'success', over: 'warning', within: 'muted', monthOnly: 'muted', monthOnlyMax: 'muted' }
export const targetTone = (kind: TargetLineKind): TargetTone => TONE[kind]

// Classify one entry; absent, target-less or value-less entries draw nothing (no fake value).
export function targetLine(entry: KpiTarget | undefined | null): TargetLine | null {
  if (!entry || entry.target == null || entry.value == null) return null
  const { value, target } = entry
  // No verdict (non-month period): a ceiling keeps its maximum wording, never a monthly-goal claim.
  if (entry.below_target == null) return { kind: entry.comparison === 'lte' ? 'monthOnlyMax' : 'monthOnly', value, target }
  if (entry.comparison === 'gte') return { kind: entry.below_target ? 'progress' : 'reached', value, target }
  if (entry.comparison === 'lte') return { kind: entry.below_target ? 'over' : 'within', value, target }
  return null
}

interface FormatArgs {
  t: (key: string, opts?: Record<string, unknown>) => string
  num: (v?: number | null) => string
  pct: (v: number) => string
}

// Translate + format a classified line for a tile (numbers through the active-locale formatters).
export function formatTargetLine(line: TargetLine, isPercent: boolean, { t, num, pct }: FormatArgs): TileTargetLine {
  const fmt = (v: number) => (isPercent ? pct(v) : num(v))
  return {
    text: t(`kpi.target.${line.kind}`, { value: fmt(line.value), target: fmt(line.target) }),
    tone: targetTone(line.kind),
  }
}

// Chart rows for the per-recruiter calls card: server order kept, the unassigned row (user_id null) always last.
export function perRecruiterRows(entry: KpiTarget | undefined | null): PerRecruiterCallsRow[] {
  const rows = entry?.per_recruiter ?? []
  return [...rows.filter(r => r.user_id != null), ...rows.filter(r => r.user_id == null)]
}
