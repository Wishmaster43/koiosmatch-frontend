import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Plus } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import api, { unwrap } from '@/lib/api'
import PlanIntakeModal from '@/pages/candidates/drawer/PlanIntakeModal'
import AddApplicationModal from '@/pages/applications/AddApplicationModal'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { mapVacancyDetail } from '../data/mapVacancy'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// Soft phase chip in the funnel-phase colour (shared soft-chip convention).
function PhaseChip({ label, color }: { label: ReactNode; color?: string | null }) {
  // Fallback swatch colour, consumed below via hex+alpha string concatenation
  // (soft-chip convention) — cannot become a CSS var without restructuring that.
  // eslint-disable-next-line no-restricted-syntax -- fallback swatch hex, consumed as hex+alpha string concat below
  const c = color ?? '#9CA3AF'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
      background: `${c}1A`, color: c, border: `1px solid ${c}55` }}>{label}</span>
  )
}

/**
 * ApplicantsTab — mostly read-only: total leads, the per-phase breakdown and the
 * list of coupled applications (each a real candidate at a funnel phase). A match
 * is the continuation of an application; editing the phase lives on the
 * application, not here (decided model — see CLAUDE.md §3B). This tab owns two
 * actions: "Intake plannen" per row, and "+ Sollicitatie" — create an application
 * FOR THIS VACANCY, reusing the applications page's own create modal with the
 * vacancy preselected + locked (Danny, vacancy drawer screenshot). This tab only
 * receives the vacancy detail as a read prop (VacancyDrawer passes no setter down
 * this far), so a freshly created application refetches THIS vacancy's detail
 * locally — the list/counters update without reopening the drawer.
 */
export default function ApplicantsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { phases, phaseMeta } = useVacancyLookups()
  // The applicant currently being booked an intake for (opens the shared modal).
  const [intakeFor, setIntakeFor] = useState<{ applicationId: Id | null; candidateId: Id } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Local override of the vacancy detail, refetched after "+ Sollicitatie" — reset
  // whenever a different vacancy is shown so a stale override never leaks across.
  const [override, setOverride] = useState<VacancyDetail | null>(null)
  useEffect(() => { setOverride(null) }, [v.id])
  const live = override ?? v

  // Refetch this vacancy's detail so the applications list + phase counts + total
  // leads reflect the just-created application right away.
  const refresh = () => {
    if (v.id == null) return
    api.get(`/vacancies/${v.id}`)
      .then(r => setOverride(mapVacancyDetail(unwrap(r))))
      .catch(() => {})
  }

  const byPhase = (live.applicationsByPhase ?? {}) as Record<string, number>
  const applications = live.applications ?? []

  return (
    <div>
      {/* Leads */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', marginBottom: 16, borderRadius: 8, background: 'var(--color-warning-bg)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning)' }}>{t('applicants.totalLeads')}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-warning)' }}>{live.leadsCount ?? 0}</span>
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

      {/* Applications list — "+ Sollicitatie" sits at the section header (§3A
          blueprint: the "+ Add" affordance in the same place/style everywhere). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t('applicants.title')}</div>
        {v.id != null && (
          <button onClick={() => setAddOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
              padding: '4px 10px', borderRadius: 7, border: '1px solid var(--color-primary)',
              background: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
            <Plus size={12} /> {t('applicants.addApplication')}
          </button>
        )}
      </div>
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
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <EntityLink page="candidates" id={a.candidateId} title={a.candidateName}>{a.candidateName}</EntityLink>
                  </div>
                  {a.source && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.source}</div>}
                </div>
                {m.label && <PhaseChip label={m.label} color={m.color} />}
                {/* Book an intake for this applicant — matches candidate + vacancy + application. */}
                {a.candidateId != null && (
                  <button onClick={() => setIntakeFor({ applicationId: a.id ?? null, candidateId: a.candidateId as Id })}
                    title={t('applicants.planIntake')} aria-label={t('applicants.planIntake')}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
                      borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)',
                      cursor: 'pointer', flexShrink: 0 }}>
                    <CalendarPlus size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {intakeFor && (
        <PlanIntakeModal candidateId={intakeFor.candidateId} applicationId={intakeFor.applicationId} defaultVacancyId={v.id ?? null}
          onClose={() => setIntakeFor(null)} onCreated={() => setIntakeFor(null)} />
      )}

      {addOpen && v.id != null && (
        <AddApplicationModal
          lockedVacancy={{ id: v.id, title: v.title, client: v.clientName }}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); refresh() }}
        />
      )}
    </div>
  )
}
