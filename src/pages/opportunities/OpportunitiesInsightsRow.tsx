/**
 * OpportunitiesInsightsRow — see the fuller docblock below, right above the
 * component, for the donut/KPI footprint this config-driven strip renders.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

interface Aggregate { name: string; key: string; value: number; color?: string }

// Group rows into donut segments [{ name, key, value, color? }] by a field accessor.
// `key` stays the RAW field value (this page filters client-only fields like `client`
// on the text itself) — only `translate` (LOOKUP-I18N-1) may change the display
// `name`, never the key a click/filter compares against.
function groupBy<T>(rows: T[], getLabel: (r: T) => string, getColor?: (r: T) => string | null, translate?: (label: string) => string): Aggregate[] {
  const m: Record<string, Aggregate> = {}
  rows.forEach(r => {
    const label = getLabel(r)
    if (!label) return
    m[label] ??= { name: translate ? translate(label) : label, key: label, value: 0, color: getColor?.(r) ?? undefined }
    m[label].value++
  })
  return Object.values(m)
}

// Stage donut: keyed on the STABLE stageValue (the same axis the client-side filter
// and every mutation use), display name translated via seedLabel — LOOKUP-I18N-1
// keeps the filter/key axis on the raw value, only `name` (legend/tooltip) is
// translated, so a donut click still narrows on the value a mixed-locale row set
// agrees on (fixes the same stage splitting into two segments after a board move).
function groupByStage(rows: Opportunity[], seedLabel: (family: string, item: { value?: string | null; label?: string | null }) => string): Aggregate[] {
  const m: Record<string, Aggregate> = {}
  rows.forEach(r => {
    if (r.stageValue == null) return
    const key = String(r.stageValue)
    m[key] ??= { name: seedLabel('opportunityStages', { value: key, label: r.stage }), key, value: 0, color: r.stageColor ?? undefined }
    m[key].value++
  })
  return Object.values(m)
}

// Owner donut is keyed on ownerId (matches the id-based owner filter) while the
// display name stays the segment's `name` — a dashboard owner_id intent, a panel
// pick and a donut click all now agree on the same id (OPP-OWNER-ID-1).
function groupByOwner(rows: Opportunity[]): Aggregate[] {
  const m: Record<string, Aggregate> = {}
  rows.forEach(r => {
    if (r.ownerId == null || !r.owner) return
    const id = String(r.ownerId)
    m[id] ??= { name: r.owner, key: id, value: 0 }
    m[id].value++
  })
  return Object.values(m)
}

interface OpportunitiesInsightsRowProps {
  rows: Opportunity[]
  stages: LookupOption[]
  stage: string[]
  owner: string[]
  client: string[]
  onPickStage: (d: unknown) => void
  onClearStage: () => void
  onPickOwner: (d: unknown) => void
  onClearOwner: () => void
  onPickClient: (d: unknown) => void
  onClearClient: () => void
  // Direct setter for the stage filter — the KPI cards drive it (won/lost/open/closed).
  // LOOKUP-I18N-1: values, never labels — mirrors `stage` above.
  onSetStageFilter: (values: string[]) => void
  // Honesty notice rendered above the cards (e.g. "a branch filter hides records with
  // no branch"). Forwarded straight to the shared InsightsRow, which already owns that
  // banner — this wrapper adds donut/KPI config, not a second styling of the same thing.
  notice?: string
}

/**
 * OpportunitiesInsightsRow — config-driven KPI strip mirroring the candidate footprint:
 * 3 click-to-filter donuts (Fase · Eigenaar · Klant) + per-unit KPI cards.
 * Per-row dealType.unit (X-5-UNIT-PER-ROW, bundle B2-2) drives the unit: euro (default),
 * hours, or quote. KPI tiles appear per unit when sum > 0. Won/lost derive from stage
 * lookup flags (is_won/is_lost).
 */
export default function OpportunitiesInsightsRow({
  rows, stages, stage, owner, client,
  onPickStage, onClearStage, onPickOwner, onClearOwner, onPickClient, onClearClient,
  onSetStageFilter, notice,
}: OpportunitiesInsightsRowProps) {
  const { t } = useTranslation('opportunities')
  // LOOKUP-I18N-1: the seeded stage label renders in the user's language; a
  // tenant rename/creation passes through untouched.
  const seedLabel = useSeedLabel()

  const { stageData, ownerData, clientData, open, pipelineEuro, avgEuro, pipelineHours, pipelineQuotes, won, lost, winRate } = useMemo(() => {
    // Terminal stages from the lookup flags — outcome is never hardcoded.
    const wonStage  = stages.find(s => s.isWon)
    const lostStage = stages.find(s => s.isLost)
    const isWonRow  = (r: Opportunity) => !!wonStage  && r.stageValue === wonStage.value
    const isLostRow = (r: Opportunity) => !!lostStage && r.stageValue === lostStage.value
    // Per-unit pipeline calculation (X-5-UNIT-PER-ROW): open deals only (won/lost
    // separate), summed by unit per row's dealTypeUnit (null/euro = euro, hours, quote).
    const openRows = rows.filter(r => !isWonRow(r) && !isLostRow(r))
    const euroRows = openRows.filter(r => (r.dealTypeUnit ?? 'euro') === 'euro' && typeof r.value === 'number')
    const hoursRows = openRows.filter(r => r.dealTypeUnit === 'hours' && typeof r.hours === 'number')
    const quoteRows = openRows.filter(r => r.dealTypeUnit === 'quote')
    const euroSum = euroRows.reduce((s, r) => s + (r.value ?? 0), 0)
    const hoursSum = hoursRows.reduce((s, r) => s + (r.hours ?? 0), 0)
    const wonCount  = rows.filter(isWonRow).length
    const lostCount = rows.filter(isLostRow).length
    return {
      stageData:  groupByStage(rows, seedLabel),
      ownerData:  groupByOwner(rows),
      clientData: groupBy(rows, r => r.client),
      open:     openRows.length,
      pipelineEuro: Math.round(euroSum),
      avgEuro:   euroRows.length ? Math.round(euroSum / euroRows.length) : 0,
      pipelineHours: Math.round(hoursSum),
      pipelineQuotes: quoteRows.length,
      won:       wonCount,
      lost:      lostCount,
      winRate:   (wonCount + lostCount) ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
    }
  }, [rows, stages, seedLabel])

  // `picked` is the visible filter-chip TEXT — resolve the picked raw value back to
  // its translated display label (LOOKUP-I18N-1: `stage`/`owner` filter state holds
  // ids/values, never a label; the chip/aria-label must never leak a raw slug/uuid).
  const pickedOwnerLabel = owner[0] ? (ownerData.find(o => o.key === owner[0])?.name ?? owner[0]) : null
  const pickedStageLabel = stage[0] ? (stageData.find(s => s.key === stage[0])?.name ?? stages.find(s => s.value === stage[0])?.label ?? stage[0]) : null
  const donuts: DonutSpec[] = [
    { key: 'stage',  title: t('insights.stage'),  data: stageData,  onPick: onPickStage,  active: stage.length > 0,  onClear: onClearStage,  picked: pickedStageLabel },
    { key: 'owner',  title: t('insights.owner'),  data: ownerData,  onPick: onPickOwner,  active: owner.length > 0,  onClear: onClearOwner,  picked: pickedOwnerLabel },
    { key: 'client', title: t('insights.client'), data: clientData, onPick: onPickClient, active: client.length > 0, onClear: onClearClient, picked: client[0] ?? null },
  ]
  // KPI clicks drive the stage filter (Danny: every card must DO something):
  // won/lost → that terminal stage; open/pipeline/avg → the running stages;
  // winrate → the closed stages. Clicking the active card again clears.
  // LOOKUP-I18N-1: keyed on stage VALUE, never the (possibly translated) label —
  // matches the filter state and Opportunity.stageValue everywhere else.
  const wonValue   = stages.find(s => s.isWon)?.value
  const lostValue  = stages.find(s => s.isLost)?.value
  const openValues = stages.filter(s => !s.isWon && !s.isLost).map(s => s.value)
  const eqSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')
  const toggleStages = (values: (string | undefined)[]) => {
    const clean = values.filter((v): v is string => !!v)
    if (clean.length) onSetStageFilter(eqSet(stage, clean) ? [] : clean)
  }
  const activeIs = (values: (string | undefined)[]) => eqSet(stage, values.filter((v): v is string => !!v))
  const kpis: KpiSpec[] = [
    { key: 'open',     label: t('kpi.open'),                                   value: open,     color: 'var(--color-primary-text)',
      onClick: () => toggleStages(openValues), active: activeIs(openValues) },
    // Per-unit pipeline tiles (X-5-UNIT-PER-ROW): one FIXED footprint (§3A equal
    // footprint) — euro, hours and quotes each get their own tile, zero included, so
    // the row never grows or shrinks with the data.
    { key: 'pipeline',      label: t('kpi.pipeline'),       value: pipelineEuro,   color: 'var(--color-success-text)',
      onClick: () => toggleStages(openValues), active: activeIs(openValues) },
    { key: 'pipelineHours', label: t('kpi.pipelineHours'),  value: pipelineHours,  color: 'var(--color-success-text)',
      onClick: () => toggleStages(openValues), active: activeIs(openValues) },
    { key: 'pipelineQuotes', label: t('kpi.pipelineQuotes'), value: pipelineQuotes, color: 'var(--color-success-text)',
      onClick: () => toggleStages(openValues), active: activeIs(openValues) },
    { key: 'avg',           label: t('kpi.avg'),            value: avgEuro,        color: 'var(--text)',
      onClick: () => toggleStages(openValues), active: activeIs(openValues) },
    { key: 'won',      label: t('kpi.won'),                                    value: won,      color: 'var(--color-success-text)',
      onClick: () => toggleStages([wonValue]), active: activeIs([wonValue]) },
    { key: 'lost',     label: t('kpi.lost'),                                   value: lost,     color: 'var(--color-danger-text)',
      onClick: () => toggleStages([lostValue]), active: activeIs([lostValue]) },
    { key: 'winrate',  label: t('kpi.winRate'),                                value: winRate,  color: 'var(--color-warning-text)',
      onClick: () => toggleStages([wonValue, lostValue]), active: activeIs([wonValue, lostValue]) },
  ]

  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('insights.clearFilter')} notice={notice} />
}
