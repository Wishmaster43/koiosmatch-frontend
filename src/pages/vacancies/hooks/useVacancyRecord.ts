/**
 * useVacancyRecord — the drawer/record data layer for VacanciesPage (§3): owns the
 * selected vacancy + its fetched detail + drawer-expanded state, the detail fetch,
 * the create-then-open flow, and the optimistic header/picker PATCH. The list state
 * lives in useVacanciesData; this hook takes its setters + the lookups it needs, so
 * the page stays presentational.
 */
import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { mapVacancyDetail } from '../data/mapVacancy'
import { initialsOf, buildVacancyPatch } from '../data/vacanciesShared'
import type { TFunction } from 'i18next'
import type { Vacancy, VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string }
interface PickerCustomer { id: Id; name: string }
type StatusMeta = (v: string) => { label?: string; color?: string }

interface Args {
  setVacancies: Dispatch<SetStateAction<Vacancy[]>>
  setTotal: Dispatch<SetStateAction<number>>
  statusMeta: StatusMeta
  users: AppUser[]
  customers: PickerCustomer[]
  t: TFunction
}

export function useVacancyRecord({ setVacancies, setTotal, statusMeta, users, customers, t }: Args) {
  const [selected,       setSelected]       = useState<Vacancy | null>(null)
  const [detail,         setDetail]         = useState<VacancyDetail | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const selectedIdRef = useRef<Id | null>(null)

  // Light row first, then fetch the full detail (ref-guarded against races).
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }
  const selectVacancy = (v: Vacancy, opts?: { forceOpen?: boolean }) => {
    // Re-clicking the SAME row toggles the drawer closed; an explicit deep-link
    // (e.g. the Leads count → Kandidaten zoeken) always (re)opens instead
    // (mirrors useCustomerRecord.selectCustomer's tab nuance).
    if (selected?.id === v.id && !opts?.forceOpen) { closeDrawer(); return }
    if (selected?.id === v.id && opts?.forceOpen) return
    selectedIdRef.current = v.id ?? null
    setSelected(v); setDetail(null); setDrawerExpanded(false)
    api.get(`/vacancies/${v.id}`)
      .then(r => { if (selectedIdRef.current === v.id) setDetail(mapVacancyDetail(unwrap(r))) })
      .catch(() => {})
  }

  // A freshly created vacancy: prepend + open its drawer (modal close stays in the page).
  const handleCreated = (v: Vacancy) => { setVacancies(prev => [v, ...prev]); setTotal(prev => prev + 1); selectVacancy(v) }

  // Header/picker edits: optimistic locally (list + selected + detail), then PATCH.
  const updateVacancy = (id: Id | undefined, patch: Record<string, unknown>): Promise<boolean> => {
    const local: Record<string, unknown> = { ...patch }
    if ('statusValue' in patch) { const m = statusMeta(patch.statusValue as string); local.statusLabel = m.label; local.statusColor = m.color }
    if ('ownerId' in patch) { const u = users.find(x => x.id === patch.ownerId); local.owner = { id: patch.ownerId, name: u?.name ?? '', initials: initialsOf(u?.name ?? ''), color: null } }
    if ('clientId' in patch) { const c = customers.find(x => x.id === patch.clientId); local.clientName = c?.name ?? '' }

    setVacancies(prev => prev.map(x => x.id === id ? ({ ...x, ...local } as Vacancy) : x))
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...local } as Vacancy) : prev))
    setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...local } as VacancyDetail) : prev))

    const body = buildVacancyPatch(patch)
    if (!Object.keys(body).length) return Promise.resolve(true)
    const request = api.patch(`/vacancies/${id}`, body)
    // MATCH-TEMPLATE-1: the server computes the actual match_weights snapshot (and
    // may clear/keep the template provenance), so re-sync those two fields from the
    // authoritative response instead of trusting the optimistic local patch. Resolve
    // true/false so a caller (MatchingTab's Save) can gate its "Saved ✓" on the REAL
    // PATCH result instead of firing it optimistically (Danny 22-07: a silently failing
    // save must never read as success — §3 no fake affordance). Errors still toast here.
    if ('matchWeights' in patch || 'matchWeightTemplateId' in patch) {
      return request.then(r => {
        const updated = mapVacancyDetail(unwrap(r))
        setDetail(prev => (prev && prev.id === id ? { ...prev, matchWeights: updated.matchWeights, matchWeightTemplateId: updated.matchWeightTemplateId } : prev))
        return true
      }).catch(() => { notifyError(t('common:actionFailed')); return false })
    }
    return request.then(() => true).catch(() => { notifyError(t('common:actionFailed')); return false })
  }

  // VAC-RESTORE-1 (BE 1ac4e14): bring an archived vacancy back; reconcile all three
  // local copies so the chip/banner clear without a refetch.
  const restoreVacancy = (id: Id | undefined) => {
    if (id == null) return
    api.post(`/vacancies/${id}/restore`)
      .then(() => {
        notifySuccess(t('drawer.archivedBanner.restored'))
        const clear = { archived: false, archivedAt: null }
        setVacancies(prev => prev.map(x => x.id === id ? ({ ...x, ...clear } as Vacancy) : x))
        setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...clear } as Vacancy) : prev))
        setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...clear } as VacancyDetail) : prev))
      })
      .catch(() => notifyError(t('drawer.archivedBanner.restoreFailed')))
  }

  return { selected, detail, drawerExpanded, setDrawerExpanded, closeDrawer, selectVacancy, handleCreated, updateVacancy, restoreVacancy }
}
