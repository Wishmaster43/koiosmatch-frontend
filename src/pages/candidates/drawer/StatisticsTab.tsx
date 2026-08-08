import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTabJs from '@/components/drawer/tabs/StatsTab'
import type { Candidate } from '@/types/candidate'

// StatsTab is still untyped JS — declare the props this tab passes.
const StatsTab = StatsTabJs as ComponentType<{ kpisTitle?: unknown; kpis?: unknown[] }>

/**
 * Statistics tab — counts only.
 *
 * STATS-HONEST-1 (Danny 2026-08-09, "en klopt statistieken wel?"): the tab used to
 * carry a "Statusoverzicht" key/value card that held no statistics at all — status,
 * last contact, contact type and branch are dossier fields, and every one of them
 * already had a home that also lets you EDIT it. They were removed here so each
 * value has exactly one source (§11):
 *   - status      → the drawer header's own deployability picker (CandidateDrawer,
 *                   metaPickers `status`), which shows AND changes it.
 *   - last contact + contact type → the drawer FOOTER (CandidateDrawer), which sits
 *                   outside the tab body and is therefore visible on this very tab:
 *                   "Laatste contact: 24-07-2026 · Bellen · door Laura Yesway".
 *                   Also a sortable column on the candidates table.
 *   - branch      → the Profiel tab's BranchSection (ProfilePanel), where it is
 *                   editable against /candidates/{id}/branches.
 *   - created on / by + source → moved earlier to the Profiel tab's Herkomst card
 *                   (CandidateOriginCard, DANNY-6).
 * What is left is what the tab name promises: numbers.
 */
export default function StatisticsTab({ c, onJump }: { c: Candidate; onJump?: (tab: string) => void }) {
  const { t } = useTranslation('candidates')
  return (
    <StatsTab
      kpisTitle={t('drawer.tabs.statistics')}
      kpis={[
        // Counts drill into the Werk tab, where the matches/applications actually live.
        { label: t('statistics.placements'),  value: c.matches?.length ?? 0,        sub: t('statistics.total'), color: 'var(--color-primary-text)', onClick: () => onJump?.('work') },
        { label: t('statistics.applications'), value: (c.applications ?? []).length, sub: t('statistics.total'), color: 'var(--color-secondary)', onClick: () => onJump?.('work') },
        // Diensten + Uren gewerkt stay hidden — measured live 2026-08-09, not guessed:
        // GET /candidates/{id} DOES carry stats.shifts_count / stats.hours_worked (and
        // mapCandidate already maps them), but both read 0 on 30 of 30 candidates probed,
        // and /sm_shifts — the Shiftmanager mirror they derive from — returns an empty
        // dataset. So there is no planning data yet: two permanent "0" tiles would state
        // "this candidate worked nothing" where the truth is "not connected yet".
        // Re-enable once /sm_shifts returns rows — and only bound to the real field: the
        // former example fallbacks (24 shifts / 186 hours) were invented numbers and must
        // never come back.
        // { label: t('statistics.shifts'),       value: c.shiftsCount ?? 0, sub: t('statistics.thisYear'), color: 'var(--color-success)' },
        // { label: t('statistics.hoursWorked'),  value: c.hoursWorked ?? 0, sub: t('statistics.thisYear'), color: 'var(--color-warning)' },
      ]}
    />
  )
}
