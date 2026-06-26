import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '../../../components/ui/Avatar'
import { useVacancyLookups } from '../../../context/VacancyLookupsContext'
import type { VacancyDetail } from '../../../types/vacancy'

// Soft phase chip in the funnel-phase colour (shared soft-chip convention).
function PhaseChip({ label, color }: { label: ReactNode; color?: string | null }) {
  const c = color ?? '#9CA3AF'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
      background: `${c}1A`, color: c, border: `1px solid ${c}55` }}>{label}</span>
  )
}

/**
 * ApplicantsTab — read-only: total leads, the per-phase breakdown and the list of
 * coupled applications (each a real candidate at a funnel phase). A match is the
 * continuation of an application; editing the phase lives on the application, not
 * here (decided model — see CLAUDE.md §3B).
 */
export default function ApplicantsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { phases, phaseMeta } = useVacancyLookups()

  const byPhase = (v.applicationsByPhase ?? {}) as Record<string, number>
  const applications = v.applications ?? []

  return (
    <div>
      {/* Leads */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', marginBottom: 16, borderRadius: 8, background: 'var(--color-warning-bg)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning)' }}>{t('applicants.totalLeads')}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-warning)' }}>{v.leadsCount ?? 0}</span>
      </div>

      {/* Per-phase breakdown — only phases with a count, in the configured order. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('applicants.byPhase')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {phases.filter(p => (byPhase[p.value] ?? 0) > 0).length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
        ) : phases.filter(p => (byPhase[p.value] ?? 0) > 0).map(p => (
          <span key={p.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            padding: '4px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            {p.label}
            <strong style={{ color: 'var(--text)' }}>{byPhase[p.value]}</strong>
          </span>
        ))}
      </div>

      {/* Applications list */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('applicants.title')}</div>
      {applications.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {applications.map(a => {
            const m = a.phaseLabel ? { label: a.phaseLabel, color: a.phaseColor } : phaseMeta(a.phaseValue != null ? String(a.phaseValue) : null)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <Avatar initials={a.candidateInitials} size={26} soft />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.candidateName}
                  </div>
                  {a.source && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.source}</div>}
                </div>
                {m.label && <PhaseChip label={m.label} color={m.color} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
