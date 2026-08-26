// candidateChangelogLine — the candidate's H2 status/phase transition line-builder,
// extracted from ChangelogTab.tsx as a pure function (§3 size discipline: keeps the
// wrapper component itself under the shared-component budget). Pure: no hooks, no
// fetch — the caller supplies the lookup meta, `t` and `formatDate` it already has.
import type { ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'

// H2 status/phase provenance entry ({ axis, from, to, effective_from, … }) — the semantic
// transition log the backend writes on every status/phase change (§3B).
export interface H2Props {
  axis?: string
  from?: string | null
  to?: string | null
  effective_from?: string | null
  reason_given?: boolean
  blacklist_reason?: string | null
  available_again_date?: string | null
}

// The two lookup resolvers the transition line needs (status vs. phase axis).
interface AxisLookups { statusMeta: (v: string) => { label: string }; phaseMeta: (v: string) => { label: string } }

// Minimal i18n shape (avoids pulling react-i18next's TFunction generics in here).
type Translate = (key: string, opts?: Record<string, unknown>) => string

// Builds one readable line for an H2 status/phase transition entry (either payload
// key) — null when the event carries no H2 payload, so the caller falls back to the
// normal per-field diff card.
export function buildH2ChangelogLine(
  ev: ChangelogEvent,
  { statusMeta, phaseMeta }: AxisLookups,
  t: Translate,
  formatDate: (iso: string) => string,
): { field: string; line: string } | null {
  const p = (ev.properties ?? ev.changes) as H2Props | undefined
  if (!p?.axis || !p?.to) return null
  const meta = p.axis === 'phase' ? phaseMeta : statusMeta
  const label = (v?: string | null) => (v ? meta(v).label : t('changelog.emptyValue'))
  const line = [
    `${label(p.from)} → ${label(p.to)}`,
    p.blacklist_reason,
    p.reason_given ? t('changelog.reasonGiven') : null,
    p.available_again_date ? t('drawer.availableAgain', { date: formatDate(p.available_again_date) }) : null,
    p.effective_from ? t('changelog.effectiveFrom', { date: formatDate(p.effective_from) }) : null,
  ].filter(Boolean).join(' · ')
  return { field: t('changelog.fields.status'), line }
}
