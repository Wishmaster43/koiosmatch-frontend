/** Work tab — matches + paginated applications, with the two candidate actions
 *  (§3B two-action model): couple to a vacancy, or plan an intake.
 *  `onRefresh` (Danny P1 "stale after match create"): replaces the DRAWER's shared
 *  record (header status/phase, Ervaring, MatchesTab) after a create — see reload().
 *
 *  Danny punt 5/7 (08-08): every application row now links to the application
 *  record, can be edited (pencil → the same form in EDIT mode) and detached
 *  (unlink → reason prompt → DELETE /applications/{id}); the row itself lives in
 *  `ApplicationRow` so this file stays the thin container it is meant to be. */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Search } from 'lucide-react'
import MatchesTab from './MatchesTab'
import PoolsSection from './PoolsSection'
import DrawerAddButton from './DrawerAddButton'
import SubTabBar from '@/components/drawer/SubTabBar'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import ApplicationRow from './ApplicationRow'
import { vacancyLabelOf } from './applicationRowModel'
import type { AppRow, Appt } from './applicationRowModel'
import DetachApplicationModal from './DetachApplicationModal'
import AddApplicationModal from './AddApplicationModal'
import PlanIntakeModal from './PlanIntakeModal'
import type { ExistingAppointment } from './PlanIntakeModal'
import MatchModal from './MatchModal'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { sectionBlock } from './constants'
import { APPLICATION_COL_STATUS, APPLICATION_COL_DATE, APPLICATION_COL_ACTIONS, APPLICATION_COL_TITLE, APPLICATION_COL_CLIENT } from './applicationRowColumns'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

// Known sub-tab ids (deep-link validation lives here, not in the drawer).
const KNOWN_SUB_TABS = ['applications', 'matches', 'pools'] as const

export default function WorkTab({ c, onRefresh, initialSubTab }: { c: Candidate; onRefresh?: () => Promise<void> | void; initialSubTab?: string }) {
  const { t, i18n } = useTranslation(['candidates', 'common'])
  // applications.update is the ONE permission the backend's own route group requires
  // for PATCH + DELETE /applications/{id} — a viewer without it never sees the
  // pencil/unlink at all (§3: no affordance the server will refuse).
  const auth = useAuth()
  const canManageApplications = auth?.hasPermission?.('applications.update') ?? false
  // applications.view guards GET /applications/{id} — the ONE request the row's
  // expand panel makes, so without it the chevron is not offered at all (§3).
  const canViewApplications = auth?.hasPermission?.('applications.view') ?? false
  // Local copy of the applications so a create shows immediately (re-fetched from
  // the candidate detail after a POST — the BE may add a vacancy-less intake row).
  const [apps, setApps] = useState<AppRow[]>((c.applications ?? []) as unknown as AppRow[])
  // Appointments (who/when/where) keyed by application_id — shown under each row.
  const [appts, setAppts] = useState<Appt[]>([])
  const [page, setPage] = useState(1)
  // Sollicitaties toolbar (Danny live review, 04-08: "Zoeken en status erbij!") —
  // free-text search on the vacancy label, applied on top of the stage filter below.
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<null | 'apply' | 'intake' | 'match'>(null)
  // The appointment being edited (pencil on the appointment line) → prefilled intake modal.
  const [editAppt, setEditAppt] = useState<ExistingAppointment | null>(null)
  // The match being edited (pencil on a MatchesTab row) → MatchModal in EDIT mode.
  const [editMatchId, setEditMatchId] = useState<Id | null>(null)
  // Punt 5: the application being edited (pencil on an application row) → the same
  // AddApplicationModal in EDIT mode (PATCH /applications/{id}).
  const [editApplicationId, setEditApplicationId] = useState<Id | null>(null)
  // Punt 7: the application being detached + the in-flight flag of that DELETE.
  const [detachRow, setDetachRow] = useState<AppRow | null>(null)
  const [detaching, setDetaching] = useState(false)
  // Reset the local list when the drawer switches to another candidate / fuller detail.
  useEffect(() => { setApps((c.applications ?? []) as unknown as AppRow[]); setPage(1) }, [c.id, c.applications])
  // Load the candidate's appointments once per candidate (separate structured entity).
  useEffect(() => {
    let alive = true
    api.get(`/candidates/${c.id}/appointments`, { quiet404: true })
      .then(r => { if (alive) setAppts((unwrapList(r).rows) as Appt[]) })
      .catch(() => {})
    return () => { alive = false }
  }, [c.id])

  // Re-fetch applications + appointments after a create so both show immediately,
  // AND replace the drawer's shared record (Danny P1: a match/application/intake
  // create used to leave MatchesTab/header status/Ervaring stale until reopen,
  // since this tab only ever updated its OWN local apps/appts state below).
  const reload = async () => {
    try {
      const [detail, ap] = await Promise.all([
        api.get(`/candidates/${c.id}`),
        api.get(`/candidates/${c.id}/appointments`, { quiet404: true }),
      ])
      const fresh = (unwrap(detail)) as { applications?: AppRow[] }
      setApps((fresh?.applications ?? []) as AppRow[]); setPage(1)
      setAppts((unwrapList(ap).rows) as Appt[])
    } catch { /* keep the current lists on a failed refresh */ }
    await onRefresh?.()
  }

  // Punt 7 — detach: measured live 08-08, DELETE /applications/{id} REQUIRES a
  // `reason` body (422 "The reason field is required." without it, 204 with it),
  // which the backend stores as an application note. Non-optimistic on purpose:
  // a 422/403 must never look like it succeeded (the dead-bulk-unlink lesson, §13).
  const detachApplication = async (reason: string) => {
    const id = detachRow?.id
    if (id == null) return
    setDetaching(true)
    try {
      await api.delete(`/applications/${id}`, { data: { reason } })
      notifySuccess(t('work.detachDone'))
      setDetachRow(null)
      await reload()
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    } finally { setDetaching(false) }
  }

  // The appointment linked to an application row (by application_id).
  const apptFor = (appId?: Id | null) => appId != null ? appts.find(a => String(a.application_id) === String(appId)) : undefined

  const PER = 5

  // Stage filter (S-cand-1, CMBE ApplicationResource::stageKey): the candidate-
  // embedded application row now carries the funnel lookup's own STABLE `stageKey`
  // alongside the resolved `stageLabel`/`stageColor` — filtering on the key means a
  // tenant renaming a stage's label no longer silently splits it into two filter
  // buckets. Falls back to the label while any row's embed still predates the
  // backend rollout (rollout-safe, AppRow.stageKey is optional). The identity a
  // row groups/filters under is therefore `s.stageKey ?? s.stageLabel`, used
  // consistently for both the derived option list and the reader below — with a
  // real key in play, the earlier "Open"/"Actief" auto-select edge case (a tenant
  // literally naming a stage that word) no longer applies: the key, not the
  // translatable label, is what useStatusFilter's active-guess heuristic sees.
  const stageIdentity = (s: AppRow): string => s.stageKey ?? s.stageLabel ?? ''
  const stageOptions: LookupOption[] = Object.values(
    apps.reduce<Record<string, LookupOption>>((acc, s) => {
      const id = stageIdentity(s)
      if (id && s.stageLabel && !acc[id]) acc[id] = { value: id, label: s.stageLabel, color: s.stageColor ?? undefined }
      return acc
    }, {})
  )
  const { value: stageFilter, toggle: toggleStage, filtered: stageFiltered } =
    useStatusFilter(apps, stageOptions, stageIdentity)

  // Free-text search on top of the stage filter — narrows on the vacancy label only.
  const q = search.trim().toLowerCase()
  const filteredApps = q ? stageFiltered.filter(s => (vacancyLabelOf(s) ?? '').toLowerCase().includes(q)) : stageFiltered

  // Reset to page 1 whenever the search/stage filter narrows the list, so a filter
  // change never strands the view on a now out-of-range page.
  useEffect(() => { setPage(1) }, [search, stageFilter])

  const pages = Math.max(1, Math.ceil(filteredApps.length / PER))
  const slice = filteredApps.slice((page - 1) * PER, page * PER)

  // INTAKE-VACANCY-ID-1: a single distinct vacancy across the candidate's own
  // applications is an unambiguous "Intake plannen" default — without vacancy_id
  // on the create payload the vacancy's leads-list stays empty (CMBE VAC-LEADS-1).
  // 0 or 2+ distinct vacancies is genuinely ambiguous — left to the modal's own
  // searchable vacancy picker rather than guessing (never string-match stage
  // labels here: funnel stages are tenant lookups, not a fixed vocabulary). This
  // KOIOS-VOORSTEL-1 (Danny 13-08, superseding the brief ALTIJD-LEEG interlude the
  // same afternoon): the sole-distinct-vacancy derivation returns — but as a MARKED
  // Koios suggestion in both modals (badge beside the field), never as the silent
  // prefill it briefly was. Koios is the face of every system proposal (§3A).
  const distinctVacancyIds = Array.from(new Set(
    apps.map(s => s.vacancy?.id).filter((id): id is Id => id != null).map(String)
  ))
  const soleVacancyId: Id | null = distinctVacancyIds.length === 1 ? distinctVacancyIds[0] : null

  // House sub-tab bar (Danny kandidaten-ronde-2, punt C): Sollicitaties · Matches ·
  // Talentenpools, sorted ALPHABETICALLY BY TRANSLATED LABEL (computed at render
  // time so the order still reads correctly once another locale reorders them) —
  // the DEFAULT open tab is always Sollicitaties/Applications regardless of where
  // the sort lands it. Each action button moves INTO the sub-tab it belongs to.
  const SUB_TABS = [
    { id: 'applications', label: t('sections.applications') },
    { id: 'matches',       label: t('sections.placements') },
    { id: 'pools',         label: t('sections.pools') },
  ].sort((a, b) => a.label.localeCompare(b.label, i18n.language))
  // Deep-link default: an unknown/stale target falls back to Sollicitaties
  // rather than blanking the tab — this component is the sub-tab validator.
  const [subTab, setSubTab] = useState(
    initialSubTab && (KNOWN_SUB_TABS as readonly string[]).includes(initialSubTab) ? initialSubTab : 'applications'
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {/* Matches — read-only list; "+ Match" now sits on MatchesTab's OWN toolbar
          row (Danny live review, 04-08: "Zoeken status en + match moet op 1 lijn!!") —
          no more separate flex-end row above it. */}
      {subTab === 'matches' && (
        <MatchesTab c={c} onEdit={setEditMatchId} onAdd={() => setModal('match')} />
      )}

      {/* Talentenpools — moved here from the Profiel tab (kept as the exact same component). */}
      {subTab === 'pools' && <PoolsSection c={c} />}

      {subTab === 'applications' && (
      <div>
        {/* No "Sollicitaties" label here (Danny addendum 4) — the sub-tab bar
            above already says it. Toolbar (Danny live review, 04-08: "Zoeken en
            status erbij!"): search (grows) → stage filter → the two actions,
            ALL ON ONE LINE — mirrors the customer drill-down toolbar footprint. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('work.searchPlaceholder')} aria-label={t('work.searchPlaceholder')}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
          </div>
          <StatusFilterSelect value={stageFilter} onToggle={toggleStage} statuses={stageOptions} />
          <div style={{ display: 'flex', gap: 6 }}>
            <DrawerAddButton onClick={() => setModal('apply')} label={t('work.addApplication')} />
            <DrawerAddButton onClick={() => setModal('intake')} icon={CalendarPlus} label={t('work.planIntake')} />
          </div>
        </div>
        <div style={sectionBlock}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Column headers (Danny live review: "Status en datum hebben geen
              kopje?"; Danny 09-08: the widths now come from the SAME shared
              constants ApplicationRow reads for its own cells — see
              applicationRowColumns.ts — so a header can never again float
              above the wrong column. The trailing cell stays empty (Danny
              09-08: "een lege kop boven de actiekolom") since pencil/unlink/
              external-link/chevron have no single label of their own. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={APPLICATION_COL_TITLE}>{t('work.vacancy')}</span>
            {/* Klant header (batch 14) — same shared column as the row's own cell. */}
            <span style={APPLICATION_COL_CLIENT}>{t('work.client')}</span>
            <span style={APPLICATION_COL_STATUS}>{t('work.colStatus')}</span>
            <span style={APPLICATION_COL_DATE}>{t('work.colDate')}</span>
            <span aria-hidden="true" data-testid="app-col-actions-header" style={APPLICATION_COL_ACTIONS} />
          </div>
          {slice.length === 0
            ? <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.applicationsEmpty')}</div>
            : slice.map((s, i) => (
              <div key={s.id != null ? String(s.id) : i} style={{ borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <ApplicationRow
                  candidateId={c.id} row={s} appointment={apptFor(s.id)}
                  canManage={canManageApplications} canView={canViewApplications}
                  onEdit={setEditApplicationId}
                  onDetach={setDetachRow}
                  onEditAppointment={setEditAppt}
                />
              </div>
            ))
          }
        </div>
        {filteredApps.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{(page - 1) * PER + 1}–{Math.min(page * PER, filteredApps.length)} {t('work.of')} {filteredApps.length}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label={t('common:prevPage')} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} aria-label={t('common:nextPage')} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page >= pages ? 'default' : 'pointer', color: page >= pages ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
          </div>
        )}
      </div>
      </div>
      )}

      {/* OWNER-DEVIATION-1: candidate owner passed from this already-loaded record
          (no refetch) so the modal can flag a recruiter/owner deviation. */}
      {modal === 'apply'  && <AddApplicationModal candidateId={c.id} candidateOwnerId={c.ownerId} candidateOwnerName={c.owner} suggestedVacancyId={soleVacancyId} onClose={() => setModal(null)} onCreated={reload} />}
      {/* RECRUITER-DEFAULT-1 (Danny 05-08): same candidate owner, threaded so the
          intake modal's recruiter picker can prefer it over the logged-in-user fallback. */}
      {modal === 'intake' && <PlanIntakeModal     candidateId={c.id} candidateOwnerId={c.ownerId} suggestedVacancyId={soleVacancyId} onClose={() => setModal(null)} onCreated={reload} />}
      {/* RECRUITER-DEFAULT-1 (point 3, Danny's ten-point round): same candidate
          owner, threaded so the match form's recruiter picker can prefer it over
          the logged-in-user fallback — mirrors the intake modal one line above. */}
      {modal === 'match'  && <MatchModal candidateId={c.id} candidateOwnerId={c.ownerId} onClose={() => setModal(null)} onCreated={reload} />}
      {editAppt && <PlanIntakeModal candidateId={c.id} existing={editAppt} onClose={() => setEditAppt(null)} onCreated={reload} />}
      {/* Punt 5: pencil on an application row — the SAME create form in EDIT mode
          (prefills from GET /applications/{id}, PATCHes only what changed). */}
      {editApplicationId != null && (
        <AddApplicationModal candidateId={c.id} candidateOwnerId={c.ownerId} candidateOwnerName={c.owner}
          editApplicationId={editApplicationId} onClose={() => setEditApplicationId(null)} onCreated={reload} />
      )}
      {/* Punt 7: unlink on an application row — reason prompt, then the DELETE. */}
      {detachRow && (
        <DetachApplicationModal label={vacancyLabelOf(detachRow) ?? '—'} submitting={detaching}
          onCancel={() => setDetachRow(null)} onConfirm={detachApplication} />
      )}
      {/* Pencil on a MatchesTab row (point 2) — same modal, in EDIT mode: prefills
          from GET /matches/{id} (the candidate's own embedded row is thin) and
          PATCHes instead of POSTing. candidateOwnerId is irrelevant here (edit mode
          never runs RECRUITER-DEFAULT-1, see useRecruiterDefault) but passed anyway
          for consistency with the create-mode call above. */}
      {editMatchId != null && <MatchModal candidateId={c.id} candidateOwnerId={c.ownerId} editMatchId={editMatchId} onClose={() => setEditMatchId(null)} onCreated={reload} />}
    </div>
  )
}
