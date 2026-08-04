import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Search } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import StatusPill from '@/components/ui/StatusPill'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { sectionTitle } from '@/components/ui/SectionCard'
import api, { unwrap } from '@/lib/api'
import PlanIntakeModal from '@/pages/candidates/drawer/PlanIntakeModal'
import AddApplicationModal from '@/pages/applications/AddApplicationModal'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { mapVacancyDetail } from '../data/mapVacancy'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// One coupled application row, as shaped by mapVacancy.ts.
interface AppRow { id?: Id; candidateId?: Id | null; candidateName?: string; candidateInitials?: string; phaseValue?: string | number | null; phaseLabel?: string | null; phaseColor?: string | null; source?: string; created?: string }

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
 *
 * TOOLBAR (V14, 04-08-house-order): mirrors WorkTab's Sollicitaties toolbar —
 * search (grows) → phase/status filter → "+ Sollicitatie" (short label, the
 * sub-tab already names the entity). Unlike WorkTab's candidate-embed, this
 * side of the coupling carries the REAL tenant phase lookup (`useVacancyLookups`)
 * with a stable `value` per row (`phaseValue`) — so the filter is wired directly
 * to that lookup rather than WorkTab's honest label-derived fallback, which only
 * exists there because of a data gap this side does not have.
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
  const applications = (live.applications ?? []) as AppRow[]

  // House toolbar: free-text search on the candidate's name, on top of the phase filter.
  const [search, setSearch] = useState('')
  const { value: phaseFilter, toggle: togglePhase, filtered: phaseFiltered } =
    useStatusFilter(applications, phases, a => String(a.phaseValue ?? ''))
  const q = search.trim().toLowerCase()
  const filteredApplications = q ? phaseFiltered.filter(a => (a.candidateName ?? '').toLowerCase().includes(q)) : phaseFiltered

  return (
    <div>
      {/* Per-phase breakdown — only phases with a count, in the configured order.
          Canon (05-08): the shared sectionTitle, reused instead of a hand-rolled heading. */}
      <div style={{ ...sectionTitle, marginBottom: 8 }}>{t('applicants.byPhase')}</div>
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

      {/* Applications list header + house toolbar: search (grows) → phase filter →
          "+ Sollicitatie" (short — the sub-tab already names the entity, DRAWER-ADD-SHORT-1). */}
      <div style={{ ...sectionTitle, marginBottom: 8 }}>{t('applicants.title')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('applicants.searchPlaceholder')} aria-label={t('applicants.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={phaseFilter} onToggle={togglePhase} statuses={phases} optionKey={s => s.value} />
        {v.id != null && (
          <DrawerAddButton onClick={() => setAddOpen(true)} label={t('applicants.addApplication')} short />
        )}
      </div>
      {applications.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.empty')}</div>
      ) : filteredApplications.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('applicants.noMatch')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredApplications.map(a => {
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
                {m.label && <StatusPill label={m.label} color={m.color} />}
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
