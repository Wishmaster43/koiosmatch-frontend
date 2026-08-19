import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Search } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { sectionTitle } from '@/components/ui/SectionCard'
import api, { unwrap } from '@/lib/api'
import PlanIntakeModal from '@/pages/candidates/drawer/PlanIntakeModal'
import AddApplicationModal from '@/pages/applications/AddApplicationModal'
// S-vacapp-1: the coupled-application ROW itself is the candidate drawer's own
// ApplicationRow — never a second row implementation. It owns the record link,
// pencil-edit, reason-gated unlink and the lazy expand panel; this tab only
// supplies the AppRow-shaped data + the candidate-identity strip above it (the
// row itself has no candidate slot — it is designed to be read inside a SINGLE
// candidate's own drawer, see applicationRowModel.ts's docblock). Reusing the
// candidates' own edit/detach modals too (same reasoning, never a vacancies-side
// fork) — see AddApplicationModal/DetachApplicationModal imports below.
import ApplicationRow from '@/pages/candidates/drawer/ApplicationRow'
import CandidateAddApplicationModal from '@/pages/candidates/drawer/AddApplicationModal'
import DetachApplicationModal from '@/pages/candidates/drawer/DetachApplicationModal'
import { vacancyLabelOf } from '@/pages/candidates/drawer/applicationRowModel'
import type { AppRow } from '@/pages/candidates/drawer/applicationRowModel'
// HUISSTIJL-1: the source-channel meta text (11px/muted) is the shared Caption atom.
import { Caption } from '@/components/ui/typography'
// PDF-VACATURES-13: the shared prev/next stepper (customer locations/contacts/
// departments already use it) — paging through the expanded application detail
// without a trip back to the list. This tab owns which application is expanded
// (ApplicationRow supports both an internal-toggle mode and this controlled mode);
// only its prop TYPE is needed here, DrillPager itself renders inside ApplicationRow.
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAuth } from '@/context/AuthContext'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mapVacancyDetail } from '../data/mapVacancy'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// One coupled application row, as shaped by mapVacancy.ts.
interface ApplicantRow { id?: Id; candidateId?: Id | null; candidateName?: string; candidateInitials?: string; phaseValue?: string | number | null; phaseLabel?: string | null; phaseColor?: string | null; source?: string; created?: string }

// Rows shown per page (mirrors WorkTab's own PER on the candidate side).
const PER = 5

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
 *
 * S-vacapp-1 (this pass): each applicant's own record row (EntityLink to the
 * application, pencil-edit, reason-gated unlink, lazy detail panel) is now the
 * SAME `ApplicationRow` the candidate drawer uses — never a second, forked row —
 * paired with pagination (PER=5, mirrors WorkTab) and gated on the same
 * `applications.update`/`applications.view` permissions.
 */
export default function ApplicantsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { phases, phaseMeta } = useVacancyLookups()
  const auth = useAuth()
  // The one permission the backend requires for PATCH + DELETE /applications/{id}
  // (mirrors WorkTab) — a viewer without it never sees pencil/unlink at all (§3).
  const canManageApplications = auth?.hasPermission?.('applications.update') ?? false
  // GET /applications/{id} sits behind applications.view — gates the expand chevron.
  const canViewApplications = auth?.hasPermission?.('applications.view') ?? false
  // The applicant currently being booked an intake for (opens the shared modal).
  const [intakeFor, setIntakeFor] = useState<{ applicationId: Id | null; candidateId: Id } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Punt 5/7 reuse: the application being edited (pencil) / detached (unlink).
  const [editApplicationId, setEditApplicationId] = useState<Id | null>(null)
  const [detachRow, setDetachRow] = useState<ApplicantRow | null>(null)
  const [detaching, setDetaching] = useState(false)
  const [page, setPage] = useState(1)
  // Local override of the vacancy detail, refetched after "+ Sollicitatie" — reset
  // whenever a different vacancy is shown so a stale override never leaks across.
  const [override, setOverride] = useState<VacancyDetail | null>(null)
  useEffect(() => { setOverride(null); setPage(1) }, [v.id])
  const live = override ?? v

  // Refetch this vacancy's detail so the applications list + phase counts + total
  // leads reflect the just-created/edited/detached application right away.
  const refresh = () => {
    if (v.id == null) return
    api.get(`/vacancies/${v.id}`)
      .then(r => setOverride(mapVacancyDetail(unwrap(r))))
      .catch(() => {})
  }

  const applications = (live.applications ?? []) as ApplicantRow[]
  // PDF-VACATURES-13: the host owns which application row is expanded, so the
  // DrillPager's next/prev can collapse the current row and open another —
  // ApplicationRow's own internal toggle cannot do that from outside.
  const [openRowId, setOpenRowId] = useState<Id | null>(null)

  // House toolbar: free-text search on the candidate's name, on top of the phase filter.
  const [search, setSearch] = useState('')
  const { value: phaseFilter, toggle: togglePhase, filtered: phaseFiltered } =
    useStatusFilter(applications, phases, a => String(a.phaseValue ?? ''))
  const q = search.trim().toLowerCase()
  const filteredApplications = q ? phaseFiltered.filter(a => (a.candidateName ?? '').toLowerCase().includes(q)) : phaseFiltered

  // Reset to page 1 whenever the search/phase filter narrows the list, so a filter
  // change never strands the view on a now out-of-range page.
  useEffect(() => { setPage(1) }, [search, phaseFilter])
  const pages = Math.max(1, Math.ceil(filteredApplications.length / PER))
  const slice = filteredApplications.slice((page - 1) * PER, page * PER)

  // PDF-VACATURES-13: page to another application's expanded detail — moves the
  // TABLE page too when the target sits outside the currently visible slice, so
  // "next" never opens a row the list itself is not showing.
  const gotoApplication = (index: number) => {
    const target = filteredApplications[index]
    if (!target) return
    setOpenRowId(target.id ?? null)
    setPage(Math.floor(index / PER) + 1)
  }
  // The pager for the CURRENTLY OPEN row — undefined for every other row, and
  // undefined entirely once the open row falls out of the active filter/search.
  const pagerFor = (a: ApplicantRow): DrillPagerProps | undefined => {
    if (openRowId == null || String(a.id) !== String(openRowId)) return undefined
    const index = filteredApplications.findIndex(x => String(x.id) === String(openRowId))
    if (index < 0) return undefined
    return {
      index: index + 1,
      total: filteredApplications.length,
      onPrev: index > 0 ? () => gotoApplication(index - 1) : undefined,
      onNext: index < filteredApplications.length - 1 ? () => gotoApplication(index + 1) : undefined,
    }
  }

  // Punt 7 reuse: DELETE /applications/{id} requires a `reason` body (measured on
  // the candidate side, WorkTab.detachApplication) — non-optimistic, so a 422/403
  // never looks like it succeeded.
  const detachApplication = async (reason: string) => {
    const id = detachRow?.id
    if (id == null) return
    setDetaching(true)
    try {
      await api.delete(`/applications/${id}`, { data: { reason } })
      notifySuccess(t('applicants.detachDone'))
      setDetachRow(null)
      refresh()
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    } finally { setDetaching(false) }
  }

  // Build the AppRow shape ApplicationRow expects — the vacancy IS this vacancy
  // (v), so the row's own title cell resolves to the real vacancy title/url
  // rather than the "Intake" fallback (which only applies to vacancy-less rows).
  const toApplicationRow = (a: ApplicantRow): AppRow => {
    // Fall back to the tenant phase lookup when the embedded row carries no
    // label of its own (mirrors the phase-chip resolution above).
    const m = a.phaseLabel ? { label: a.phaseLabel, color: a.phaseColor } : phaseMeta(a.phaseValue != null ? String(a.phaseValue) : null)
    return {
      id: a.id,
      vacancy: v.id != null ? { id: v.id, title: v.title } : undefined,
      stageLabel: m.label ?? undefined,
      stageKey: a.phaseValue != null ? String(a.phaseValue) : undefined,
      stageColor: m.color ?? undefined,
      created_at: a.created,
      client_name: v.clientName ?? null,
    }
  }

  return (
    <div>
      {/* PDF-VACATURES-11: the "Per fase" breakdown block was dropped (Danny) — the
          phase filter in the toolbar below still narrows by phase, it just no
          longer duplicates the counts as a separate row of chips above the list. */}

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
          {slice.map(a => {
            return (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
                {/* Candidate identity strip — ApplicationRow has no candidate slot
                    by design (it is read inside a SINGLE candidate's own drawer),
                    so this tab supplies it above the reused row itself. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 4px' }}>
                  <Avatar initials={a.candidateInitials} size={26} soft />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <EntityLink page="candidates" id={a.candidateId} title={a.candidateName}>{a.candidateName}</EntityLink>
                  </div>
                  {a.source && <Caption as="div">{a.source}</Caption>}
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
                {/* Reused record row: EntityLink to the application, pencil-edit,
                    reason-gated unlink, lazy expand panel — the exact candidate-
                    drawer component, never a second implementation (S-vacapp-1). */}
                {/* FAKE-AFFORDANCE-1 (audit): no vacancy-level appointments endpoint exists yet
                    (WorkTab's edit-intake pencil reads /candidates/{id}/appointments, one candidate
                    at a time — there is no batched per-vacancy equivalent this tab could call for
                    every applicant row). Without an `appointment` prop ApplicationRow never renders
                    the pencil at all, so no dead button reaches the DOM; `onEditAppointment` is a
                    required prop on the shared row and stays a documented no-op until a batched
                    endpoint lands (reported in skipped, not silently left as a fake affordance). */}
                {a.candidateId != null && (
                  <ApplicationRow
                    candidateId={a.candidateId as Id}
                    row={toApplicationRow(a)}
                    canManage={canManageApplications}
                    canView={canViewApplications}
                    onEdit={setEditApplicationId}
                    onDetach={() => setDetachRow(a)}
                    onEditAppointment={() => {}}
                    // PDF-VACATURES-13: this tab owns which row is open, so the row's
                    // own DrillPager can step to the next/prev application in place.
                    expanded={openRowId != null && String(a.id) === String(openRowId)}
                    onToggleExpanded={() => setOpenRowId(prev => (prev != null && String(prev) === String(a.id) ? null : (a.id ?? null)))}
                    pager={pagerFor(a)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      {filteredApplications.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{(page - 1) * PER + 1}–{Math.min(page * PER, filteredApplications.length)} {t('applicants.of')} {filteredApplications.length}</span>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page >= pages ? 'default' : 'pointer', color: page >= pages ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
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

      {/* Punt 5 reuse: same candidate-drawer edit form, EDIT mode (PATCH /applications/{id}). */}
      {editApplicationId != null && (() => {
        const row = applications.find(a => a.id === editApplicationId)
        return row?.candidateId != null ? (
          <CandidateAddApplicationModal candidateId={row.candidateId as Id}
            editApplicationId={editApplicationId} onClose={() => setEditApplicationId(null)}
            onCreated={() => { setEditApplicationId(null); refresh() }} />
        ) : null
      })()}

      {/* Punt 7 reuse: same reason-collecting unlink prompt, then DELETE. */}
      {detachRow && (
        <DetachApplicationModal label={vacancyLabelOf(toApplicationRow(detachRow)) ?? v.title ?? '—'} submitting={detaching}
          onCancel={() => setDetachRow(null)} onConfirm={detachApplication} />
      )}
    </div>
  )
}
