import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTabJs from '@/components/drawer/tabs/StatsTab'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import type { Candidate } from '@/types/candidate'

// StatsTab is still untyped JS — declare the props this tab passes.
const StatsTab = StatsTabJs as ComponentType<{ kpisTitle?: unknown; kpis?: unknown[]; overview?: unknown; activity?: unknown }>

// Empty-state value: an italic muted em-dash (§4 — italic reserved for
// secondary/placeholder text, never data) for the two fields below that may be
// unset on legacy rows (no stamped creator / no acquisition channel recorded).
const emptyValue = <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>—</span>

/** Statistics tab — maps the candidate onto the generic StatsTab. */
export default function StatisticsTab({ c, onJump }: { c: Candidate; onJump?: (tab: string) => void }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Resolve the status + contact-type SLUGS to their tenant labels — the overview
  // showed the raw English slug ("available") instead of "Beschikbaar" (Danny).
  const { statusMeta } = useLookups() as unknown as { statusMeta: (v?: string | null) => { label: string } }
  const { labelOf: lastContactLabel } = useLastContactTypes()
  return (
    <StatsTab
      kpisTitle={t('drawer.tabs.statistics')}
      kpis={[
        // Counts drill into the Werk tab, where the matches/applications actually live.
        { label: t('statistics.placements'),  value: c.matches?.length ?? 0,        sub: t('statistics.total'),    color: 'var(--color-primary)', onClick: () => onJump?.('work') },
        { label: t('statistics.applications'), value: (c.applications ?? []).length, sub: t('statistics.total'),    color: 'var(--color-secondary)', onClick: () => onJump?.('work') },
        // Tijdelijk verborgen (2026-06-27) — Diensten + Uren gewerkt terug zodra de planning-data live is.
        // { label: t('statistics.shifts'),       value: c.shiftsCount ?? 24,         sub: t('statistics.thisYear'), color: 'var(--color-success)' },
        // { label: t('statistics.hoursWorked'),  value: c.hoursWorked ?? 186,          sub: t('statistics.thisYear'), color: 'var(--color-warning)' },
      ]}
      overview={{
        title: t('statistics.statusOverview'),
        rows: [
          [t('statistics.status'),      c.status ? statusMeta(c.status).label : '-'],
          [t('statistics.lastContact'), c.lastContactDate ? formatDate(c.lastContactDate) : '-'],
          [t('statistics.contactType'), c.lastContactType ? lastContactLabel(c.lastContactType) : '-'],
          [t('statistics.memberSince'), c.created ? formatDate(c.created) : '-'],
          [t('statistics.branch'),      (c.branches ?? []).map(b => b.name).filter(Boolean).join(', ') || '-'],
          // CREATED-BY-SOURCE-1 (Danny: "wil ik ook zien aangemaakt door wie en de bron").
          [t('statistics.createdBy'),   c.createdBy?.name || emptyValue],
          [t('statistics.source'),      c.source || emptyValue],
        ],
      }}
    />
  )
}
