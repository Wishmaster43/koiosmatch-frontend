/**
 * useApplicationDrawerActions — drawer open/close state + the single-record
 * mutations of the applications page (§0.3 split from ApplicationsPage, mirrors
 * useCandidateDrawerActions): select (light row → full record fetch), move/
 * owner/vacancy-link/source edits, reject, manual score adjust, custom fields,
 * detach (soft-delete) and restore. List updates stay optimistic; the backend
 * re-validates (§3B). Candidate name/function editing was removed from the
 * Sollicitatie tab (Danny 21-07) — that is candidate-owned data, edited on the
 * candidate record itself, not from within an application.
 */
import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mapApplication, mapApplicationDetail } from '../data/mapApplication'
import { bucketOfPhase } from '../data/applicationsShared'
import type { Application, ApplicationDetail } from '@/types/application'
import type { RejectPayload } from '../drawer/RejectionBlock'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

interface Args {
  applications: Application[]
  wideRows: Application[]
  setApplications: Dispatch<SetStateAction<Application[]>>
  setTotal: Dispatch<SetStateAction<number>>
  funnelTypes: LookupItem[]
  users: Array<{ id: Id; name: string }>
  // The active bucket TAB (from useApplicationFilters) — handleMove's "moved out
  // of view" toast compares the new bucket against it.
  bucket: string
  // Resolve an application's phase label/colour from the funnel lookup (de-hardcoded).
  decorate: <T extends Application>(a: T) => T
  t: TFunction
}

export function useApplicationDrawerActions({ applications, wideRows, setApplications, setTotal, funnelTypes, users, bucket, decorate, t }: Args) {
  const [selected, setSelected] = useState<ApplicationDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  const selectedIdRef = useRef<Id | null>(null)

  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setExpanded(false) }

  // Open an application: show the light row immediately, then fetch the full detail.
  const selectApplication = (a: Application) => {
    if (selected?.id === a.id) { closeDrawer(); return }
    selectedIdRef.current = a.id ?? null
    setSelected(decorate(a) as ApplicationDetail); setExpanded(false)
    // APP-DELETED-AT-1 (measured live, CMFE 2026-07-17): a row opened straight from
    // the Gearchiveerd quick-view IS soft-deleted server-side — ApplicationController::
    // show() 404s on it (`findOrFail` excludes trashed rows) unless asked to reveal
    // them, exactly like the list. `include_archived=1` is always safe to send here:
    // it only WIDENS the query scope (withTrashed), never narrows an active row's own
    // lookup, so this fixes the archived case without any branching on `a.archived`.
    api.get(`/applications/${a.id}`, { params: { include_archived: 1 } })
      .then(r => { if (selectedIdRef.current === a.id) setSelected(decorate(mapApplicationDetail(unwrap(r), funnelTypes))) })
      .catch(() => {})
  }

  // Kanban move: set the new phase + bucket; label/colour re-resolve from the lookup.
  // `before` checks wideRows too — the board (where a move is dragged) renders off
  // wideRows, which the table-page `applications` array doesn't hold while in board view.
  const handleMove = (id: Id, phaseKey: string) => {
    const before = applications.find(a => a.id === id) ?? wideRows.find(a => a.id === id)
    const newBucket = bucketOfPhase(phaseKey, funnelTypes)
    setApplications(prev => prev.map(a => a.id === id ? { ...a, phaseKey, bucket: newBucket } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, phaseKey, bucket: newBucket } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { phase_key: phaseKey })
      .then(() => {
        // Only claim the move AFTER the server accepted it — the old order showed
        // "Verplaatst" and then failed (Danny 2026-07-13).
        if (newBucket !== bucket) notifySuccess(t('board.movedHidden'))
      })
      .catch(err => {
        // Revert the optimistic move and surface the SERVER's reason (a bare
        // "Actie mislukt" hid why the 422 happened).
        if (before) {
          setApplications(prev => prev.map(a => a.id === id ? { ...a, phaseKey: before.phaseKey, bucket: before.bucket } : a))
          setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, phaseKey: before.phaseKey, bucket: before.bucket } as ApplicationDetail) : prev))
        }
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // Reassign an application's recruiter (owner); optimistic + PATCH owner_id.
  const handleOwner = (id: Id, ownerId: string) => {
    const u = users.find(x => String(x.id) === String(ownerId))
    if (!u) return
    const initials = u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    const owner = { id: ownerId, name: u.name, initials, color: null }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, owner } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, owner } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { owner_id: ownerId }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Re-link (or unlink, null) an application's vacancy — shared by the Sollicitatie
  // tab's Details block and the Vacature tab. Klant is derived from the picked
  // option so the row/drawer update instantly; the PATCH response then reconciles
  // both fields (the backend is the source of truth). A model guard refuses the
  // change once a Match hangs on the is_match stage (422) — surface ITS message,
  // never a generic one, and revert the optimistic edit.
  const handleLinkVacancy = (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => {
    if (id == null) return
    // wideRows fallback: the drawer may be open while viewing the board (see handleMove).
    const before = applications.find(a => a.id === id) ?? wideRows.find(a => a.id === id)
    const patch = { vacancyId, vacancyTitle: vacancyId != null ? (meta?.title ?? '') : '', client: vacancyId != null ? (meta?.client ?? '') : '' }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { vacancy_id: vacancyId })
      .then(res => {
        const updated = mapApplication(unwrap(res), funnelTypes)
        const reconciled = { vacancyId: updated.vacancyId, vacancyTitle: updated.vacancyTitle, client: updated.client }
        setApplications(prev => prev.map(a => a.id === id ? { ...a, ...reconciled } : a))
        setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...reconciled } as ApplicationDetail) : prev))
      })
      .catch(err => {
        if (before) {
          const revert = { vacancyId: before.vacancyId, vacancyTitle: before.vacancyTitle, client: before.client }
          setApplications(prev => prev.map(a => a.id === id ? { ...a, ...revert } : a))
          setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...revert } as ApplicationDetail) : prev))
        }
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // S7: PATCH the editable Bron field from the Sollicitatie tab's Details block
  // (mirrors handleOwner's simple optimistic-patch-then-PATCH shape).
  const handleUpdateSource = (id: Id | undefined, source: string) => {
    const before = applications.find(a => a.id === id) ?? wideRows.find(a => a.id === id)
    setApplications(prev => prev.map(a => a.id === id ? { ...a, source } : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, source } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { source }).catch(() => {
      if (before) {
        setApplications(prev => prev.map(a => a.id === id ? { ...a, source: before.source } : a))
        setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, source: before.source } as ApplicationDetail) : prev))
      }
      notifyError(t('common:actionFailed'))
    })
  }

  // Reject an application: move it to the FLAGGED is_rejected phase/bucket
  // optimistically — never the literal 'rejected' key (A1: a tenant may rename it).
  const handleReject = (id: Id | undefined, payload: RejectPayload) => {
    const rejectedKey = funnelTypes.find(f => f.is_rejected)?.value ?? 'rejected'
    const patch = { phaseKey: rejectedKey, bucket: bucketOfPhase(rejectedKey, funnelTypes),
      rejection: { reason_label: payload.reason_label, note: payload.note } }
    setApplications(prev => prev.map(a => a.id === id ? ({ ...a, ...patch } as Application) : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    // The message (channel + template) is sent by the rejection workflow.
    api.post(`/applications/${id}/reject`, { reason_id: payload.reason_id, note: payload.note }).catch(() => {})
  }

  // Manual match-score override on an application (per applicant); optimistic + PATCH.
  const handleAdjustScore = (id: Id | undefined, { score, criteria }: { score: number | null; criteria: Criterion[] }) => {
    const patch = { score, matchCriteria: criteria, matchSource: 'manual' }
    setApplications(prev => prev.map(a => a.id === id ? ({ ...a, ...patch } as Application) : a))
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, ...patch } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { match_score: score, match_criteria: criteria }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Save the Extra tab's tenant custom fields (§3B); the tab only mounts while the
  // drawer is open, so `selected` is always the record being edited. Optimistic +
  // PATCH, merging the partial patch into the full map so the backend persists it whole.
  const handleUpdateCustomFields = (id: Id | undefined, patch: Record<string, unknown>) => {
    const merged = { ...(selected?.customFields ?? {}), ...patch }
    setSelected(prev => (prev && prev.id === id ? decorate({ ...prev, customFields: merged } as ApplicationDetail) : prev))
    api.patch(`/applications/${id}`, { custom_fields: merged }).catch(() => notifyError(t('common:actionFailed')))
  }

  // Detach (soft-delete) an application: kept server-side, removed from the active
  // list. S15 (BE cb1e684): DELETE now REQUIRES a `reason` (422 without one) —
  // the drawer's DetachReasonModal collects it — and the backend writes it as a
  // note the Notities tab shows. Non-optimistic (unlike the old version): a 422
  // must never look like it succeeded. On success the row leaves the active list,
  // but the drawer STAYS OPEN and refetches the SAME record with
  // ?include_archived=1 (required for a soft-deleted row, see ApplicationController::
  // show) so it shows the archived state honestly with its restore path, instead
  // of just vanishing (mirrors the candidate archived-banner UX). Gated by
  // applications.update in the drawer footer.
  //
  // APP-DELETED-AT-1 (CMFE 2026-07-17): ApplicationListResource/DetailResource now
  // send real `archived`/`deleted_at` fields on every GET — previously NEITHER
  // resource sent them at all, so this handler had to force `archived: true` by
  // hand onto the refetched record (a resource gap identical in shape to S20's,
  // just on reads instead of writes). That workaround is gone: the refetch below
  // trusts mapApplicationDetail's own derivation. The LIST row still gets an
  // explicit optimistic flag (a 204 DELETE has no body to reconcile from), and
  // the refetch's own `.catch` keeps a local fallback for the rare case where
  // the GET itself fails right after a detach that we know succeeded.
  const handleDetach = (id: Id | undefined, reason: string) => {
    if (id == null) return
    api.delete(`/applications/${id}`, { data: { reason } })
      .then(() => {
        notifySuccess(t('detach.done'))
        setApplications(prev => prev.map(a => a.id === id ? { ...a, archived: true } : a))
        setTotal(prev => Math.max(0, prev - 1))
        api.get(`/applications/${id}`, { params: { include_archived: 1 } })
          .then(r => { if (selectedIdRef.current === id) setSelected(decorate(mapApplicationDetail(unwrap(r), funnelTypes))) })
          .catch(() => { if (selectedIdRef.current === id) setSelected(prev => (prev && prev.id === id ? { ...prev, archived: true } : prev)) })
      })
      .catch(err => {
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // Restore a detached application: back to the active list (backend re-sets the
  // candidate to the applicant phase). Optimistic + total increment; revert-by-id +
  // toast on failure (see handleDetach's note on why not a snapshot).
  const handleRestore = (id: Id | undefined) => {
    if (id == null) return
    setApplications(prev => prev.map(a => a.id === id ? { ...a, archived: false } : a))
    setTotal(prev => prev + 1)
    closeDrawer()
    api.post(`/applications/${id}/restore`)
      .then(() => notifySuccess(t('restore.done')))
      .catch(() => {
        setApplications(prev => prev.map(a => a.id === id ? { ...a, archived: true } : a))
        setTotal(prev => Math.max(0, prev - 1))
        notifyError(t('common:actionFailed'))
      })
  }

  return {
    selected, setSelected, expanded, setExpanded, closeDrawer, selectApplication,
    handleMove, handleOwner, handleLinkVacancy, handleUpdateSource, handleReject,
    handleAdjustScore, handleUpdateCustomFields, handleDetach, handleRestore,
  }
}
