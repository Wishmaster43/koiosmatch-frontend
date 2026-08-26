// ChangelogTab — the candidate's audit trail in end-user terms (Danny 2026-07-04,
// mirror HelloFlex's Historie). Thin wrapper around the shared
// `components/drawer/tabs/EntityChangelogTab` (§11 LANE-B): only the fetch, the
// lookup-label resolution and the H2 status/phase transition line are candidate-specific
// (the H2 line-builder itself lives in `candidateChangelogLine.ts`, a pure function).
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useCandidateActivity } from '../hooks/useCandidateDrawerData'
import { useLookups } from '@/context/LookupsContext'
import EntityChangelogTab, { type ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'
import { buildH2ChangelogLine } from './candidateChangelogLine'
import type { Candidate } from '@/types/candidate'

// Bookkeeping fields carry no user meaning — never show them as diff rows.
const NOISE_FIELDS = ['external_id', 'remember_token', 'password', 'candidate_user_id', 'user_id', 'initials', 'uuid']

// The candidate's changelog content (icon-popover, §3A(d)). `bare` is accepted for
// call-site compatibility but has no effect: this content never had a non-popover
// call site, so the old SectionCard-wrapped branch was dead code.
export default function ChangelogTab({ c }: { c: Candidate; bare?: boolean }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useCandidateActivity(c?.id)
  // Lookup meta so transition/diff values render as their tenant labels (not slugs).
  const { statusMeta, phaseMeta, funnelMeta, typeMeta } = useLookups() as unknown as {
    statusMeta: (v: string) => { label: string }; phaseMeta: (v: string) => { label: string }
    funnelMeta: (v: string) => { label: string }; typeMeta: (v: string) => { label: string }
  }

  // Known lookup-slug fields resolve to their tenant label; an empty value or any
  // other field defers to the shared generic formatting (booleans/dates/uuids).
  const formatValue = (field: string, val: unknown): string | undefined => {
    if (val === null || val === undefined || val === '') return undefined
    if (Array.isArray(val)) {
      if (field !== 'candidate_types') return undefined
      return val.length ? val.map(x => typeMeta(String(x)).label).join(', ') : t('changelog.emptyValue')
    }
    const s = String(val)
    if (field === 'status')      return statusMeta(s).label
    if (field === 'phase')       return phaseMeta(s).label
    if (field === 'funnel_type') return funnelMeta(s).label
    return undefined
  }

  // Delegates to the extracted pure builder; replaces the normal per-field diff
  // card entirely for an H2 status/phase transition event.
  const extraCard = (ev: ChangelogEvent, base: { when?: string; who: string; action: string }) => {
    const h2 = buildH2ChangelogLine(ev, { statusMeta, phaseMeta }, t, formatDate)
    return h2 ? { ...base, ...h2 } : null
  }

  return (
    <EntityChangelogTab
      items={items as ChangelogEvent[]} loading={loading} error={error} namespace="candidates"
      noiseFields={NOISE_FIELDS} formatValue={formatValue} extraCard={extraCard}
      toolbar exportFileNameBase={`changelog-${c?.name ?? 'candidate'}`}
    />
  )
}
