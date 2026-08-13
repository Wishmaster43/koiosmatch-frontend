import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTabJs from '@/components/drawer/tabs/StatsTab'
import SectionCard, { sectionTitle } from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import api, { unwrapList } from '@/lib/api'
import { useCandidateNotes } from '@/pages/candidates/hooks/useCandidateNotes'
import { useCandidateStatistics } from '@/pages/candidates/hooks/useCandidateStatistics'
import type { Appt } from './applicationRowModel'
import type { Candidate } from '@/types/candidate'

// StatsTab is still untyped JS — declare the props this tab passes.
const StatsTab = StatsTabJs as ComponentType<{ kpisTitle?: unknown; kpis?: unknown[] }>

/**
 * Statistics tab — honest, derived numbers only (STATS-HONEST-1 / B11 point 19).
 *
 * The tab used to carry a "Statusoverzicht" key/value card that held no statistics
 * at all — status, last contact, contact type and branch are dossier fields, each
 * with its own editable home elsewhere in the drawer (see the block below). What
 * this tab shows now is genuinely derived from data the drawer already has, or a
 * cheap side-load (notes/appointments) it fetches itself:
 *   - status      → the drawer header's own deployability picker (CandidateDrawer,
 *                   metaPickers `status`), which shows AND changes it.
 *   - branch      → the Profiel tab's BranchSection (ProfilePanel), where it is
 *                   editable against /candidates/{id}/branches.
 *   - created on / by + source → the Profiel tab's Herkomst card (DANNY-6).
 * Every block below renders ONLY when its source data actually loaded/exists —
 * never a fabricated zero for data that was never fetched (§3 four-states rule:
 * a block with no source is simply absent, not a fake "0").
 */
export default function StatisticsTab({ c, onJump }: { c: Candidate; onJump?: (tab: string) => void }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()

  // Notes are a separate resource (mirrors CommunicationTab) — `loaded` tells
  // "still loading" apart from "genuinely zero notes" so the block never renders
  // a false "0 notes" before the fetch has even settled.
  const { notes, loaded: notesLoaded } = useCandidateNotes(c.id)

  // Appointments — same cheap per-id fetch WorkTab already does for the Sollicitaties
  // list; loaded here too so the intake block only appears once real data arrived.
  const [appointments, setAppointments] = useState<Appt[] | null>(null)
  useEffect(() => {
    let alive = true
    setAppointments(null)
    if (!c.id) return
    api.get(`/candidates/${c.id}/appointments`, { quiet404: true })
      .then(res => { if (alive) setAppointments(unwrapList(res).rows as Appt[]) })
      .catch(() => { if (alive) setAppointments([]) })
    return () => { alive = false }
  }, [c.id])

  const stats = useCandidateStatistics(c, notesLoaded ? notes : null, appointments)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatsTab
        kpisTitle={t('drawer.tabs.statistics')}
        kpis={[
          // Counts drill into the Werk tab, where the matches/applications actually live.
          { label: t('statistics.placements'), value: stats.matchesTotal, sub: t('statistics.total'), color: 'var(--color-primary-text)', onClick: () => onJump?.('work') },
          { label: t('statistics.applications'), value: stats.applicationsTotal, sub: t('statistics.total'), color: 'var(--color-secondary)', onClick: () => onJump?.('work') },
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

      {/* Applications grouped by their live funnel stage — hidden with zero applications
          (an empty group list would say "no outcomes" of a candidate who never applied). */}
      {stats.applicationsByOutcome.length > 0 && (
        <div>
          <div style={sectionTitle}>{t('statistics.byOutcome')}</div>
          <SectionCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stats.applicationsByOutcome.map(b => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color ?? 'var(--color-primary)', flexShrink: 0 }} />
                    {b.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', color: 'var(--text-muted)' }}>{b.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Intakes/appointments — only once the side-load resolved with real rows. */}
      {stats.appointments && (
        <div>
          <div style={sectionTitle}>{t('statistics.appointments')}</div>
          <SectionCard>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', color: 'var(--text)' }}>{stats.appointments.total}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {stats.appointments.upcoming} {t('statistics.appointmentsUpcoming')} · {stats.appointments.completed} {t('statistics.appointmentsCompleted')}
              </span>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Notes count + last contact — each half renders only when its own source exists. */}
      {(stats.notesCount !== null || stats.lastContactAt) && (
        <div>
          <div style={sectionTitle}>{t('statistics.notes')}</div>
          <SectionCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {stats.notesCount !== null && (
                <div style={{ color: 'var(--text)' }}>{t('statistics.notesCount', { count: stats.notesCount })}</div>
              )}
              {stats.lastContactAt && (
                <div style={{ color: 'var(--text-muted)' }}>
                  {t('statistics.lastContact')}: {t('statistics.lastContactValue', { date: formatDate(stats.lastContactAt), type: stats.lastContactType ?? '—' })}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Days since creation / last phase change — each line only when its own source date exists. */}
      {(stats.daysSinceCreated !== null || stats.daysSincePhaseChange !== null) && (
        <div>
          <div style={sectionTitle}>{t('statistics.timeline')}</div>
          <SectionCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              {stats.daysSinceCreated !== null && <div>{t('statistics.daysSinceCreated', { count: stats.daysSinceCreated })}</div>}
              {stats.daysSincePhaseChange !== null && <div>{t('statistics.daysSincePhaseChange', { count: stats.daysSincePhaseChange })}</div>}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
