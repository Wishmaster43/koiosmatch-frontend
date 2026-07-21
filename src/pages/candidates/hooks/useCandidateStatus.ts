/**
 * useCandidateStatus — the phase/status axis logic of the candidate drawer
 * (§0.3 split from CandidateDrawer): phase badge + convert, deployability
 * changes driven by the status-lookup flags (requires_match → link a Match,
 * requires_reason / expects_return_date → prompt first; re-picking the current
 * flagged status = edit its reason/date). Pure logic + modal state; rendering
 * stays in the drawer.
 */
import { useState } from 'react'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import { useCandidatePlacedMatch } from './useCandidatePlacedMatch'
import { makeRequiredComplete } from '../drawer/candidateStatusInfo'
import type { StatusFlags } from '../drawer/candidateStatusInfo'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

// Reason/return-date prompt state (driven by the status lookup flags).
export interface StatusModalState {
  target: string; reason: string; date: string
  needReason: boolean; needDate: boolean; isBlacklist?: boolean
}

interface Args {
  c: Candidate | null
  onUpdate?: (id: Id, patch: Record<string, unknown>) => void
  // Called when a convert lands on a phase whose required fields are incomplete.
  onConvertIncomplete?: (setActiveTab?: (id: string) => void) => void
}

export function useCandidateStatus({ c, onUpdate, onConvertIncomplete }: Args) {
  const { phases, statuses, phaseMeta } = useLookups() as unknown as {
    phases: LookupOption[]; statuses: LookupOption[]
    phaseMeta: (v?: string | null) => { label: string; color: string }
  }
  const allSettings = useAllSettings()

  // Optimistic overrides + the reason/date prompt (the placed→match prompt lives
  // in the useCandidatePlacedMatch sub-hook below).
  const [phase,  setPhase]  = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [statusModal,       setStatusModal]       = useState<StatusModalState | null>(null)
  // Convert guard — blocks an accidental CV click right after converting.
  const [converting,        setConverting]        = useState(false)
  // "Placed requires a Match" sub-flow (prompt + create/link + confirm).
  const placed = useCandidatePlacedMatch({ c, onUpdate, setStatus })

  // Reset the overrides when a different candidate is shown (render-time state adjust).
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setPhase(null); setStatus(null); placed.setMatchPrompt(false); placed.setMatchChoice(null); setStatusModal(null); setConverting(false)
  }

  const currentPhase = phase ?? c?.phase
  // Fase: colour-coded read-only badge (no picker); "convert" advances the entry (first) phase.
  const phaseInfo    = phaseMeta(currentPhase)
  const phaseIdx     = phases.findIndex(p => p.value === currentPhase)
  const nextPhase    = phaseIdx >= 0 ? phases[phaseIdx + 1] : undefined
  const isEntryPhase = phaseIdx === 0

  // Convert to the next phase; jump to Profile-edit unless its required fields are complete.
  // DEFAULT-STATUS-1 (Danny 2026-07-13): a fresh Kandidaat gets the tenant's default
  // deployability status (setting; 'none' = leave empty) in the SAME patch as the
  // phase — only when no status is set yet, and never a flagged status (those need
  // their own prompt). The BE first-application automation applies the same key.
  const doConvert = (setActiveTab?: (id: string) => void) => {
    if (!nextPhase || !c) return
    const patch: Record<string, unknown> = { phase: nextPhase.value }
    const defRaw = (allSettings as Record<string, unknown> | null)?.['candidate_default_status_on_convert']
    const def = typeof defRaw === 'string' ? defRaw : 'available'
    const defStatus = statuses.find(s => s.value === def) as (LookupOption & { requires_match?: unknown; requires_reason?: unknown; expects_return_date?: unknown; is_blacklist?: unknown }) | undefined
    const wantsDefault = !(status ?? c.status) && def !== 'none' && defStatus && !defStatus.requires_match && !defStatus.is_blacklist
    const needsPrompt = wantsDefault && (Boolean(defStatus.requires_reason) || Boolean(defStatus.expects_return_date))
    if (wantsDefault && !needsPrompt) {
      setStatus(def)
      patch.status = def
    }
    setPhase(nextPhase.value)
    onUpdate?.(c.id, patch)
    // A reason/date-flagged default can't be set silently (that's how the reason-less
    // seed rows happened) — open the usual prompt so the reason lands properly.
    if (needsPrompt) {
      setStatusModal({ target: def, reason: '', date: '', needReason: Boolean(defStatus.requires_reason), needDate: Boolean(defStatus.expects_return_date), isBlacklist: false })
    }
    setConverting(true); setTimeout(() => setConverting(false), 1000)
    const requiredComplete = makeRequiredComplete(c, allSettings)
    if (!requiredComplete(nextPhase.value)) onConvertIncomplete?.(setActiveTab)
  }

  const currentStatus = status ?? c?.status
  // Deployability only applies once someone is a Kandidaat — a Lead isn't deployable yet.
  const showStatus = !!currentPhase && !isEntryPhase
  // Flags of the CURRENT status (§3B) — drive the prefilled reason/date edit path.
  const statusFlags = statuses.find(s => s.value === currentStatus) as StatusFlags
  // Whether an "edit reason/date" pencil should show anywhere in the drawer (the
  // Voorkeuren status banner + the Tijdlijn statuswissel row): flag-driven, never
  // slug-hardcoded — true when the lookup requires a reason/date for this status,
  // OR the candidate already carries a value worth editing (Danny 2026-07-20).
  const canEditStatusReason = Boolean(
    statusFlags?.requires_reason || statusFlags?.expects_return_date || statusFlags?.is_blacklist ||
    c?.statusReason || c?.statusReturnDate || c?.blacklistReason,
  )

  // Edit the reason/return date of the CURRENT status: reopen the prompt prefilled.
  const openStatusEdit = () => {
    if (!statusFlags || !c || !currentStatus) return
    setStatusModal({
      target: currentStatus,
      reason: (statusFlags.is_blacklist ? c.blacklistReason : c.statusReason) ?? '',
      date: (c.statusReturnDate ?? '').slice(0, 10),
      needReason: !!statusFlags.requires_reason,
      needDate: !!statusFlags.expects_return_date,
      isBlacklist: !!statusFlags.is_blacklist,
    })
  }

  // Status change, driven by the lookup flags: requires_match → link a Match first;
  // requires_reason / expects_return_date → prompt; otherwise PATCH straight away.
  // Re-picking the CURRENT flagged status opens the PREFILLED edit modal — with the
  // header info line gone (Danny 13/7) this is the way to adjust reason/return date.
  const changeStatus = (v: string) => {
    if (!c) return
    if (v === currentStatus && (statusFlags?.requires_reason || statusFlags?.expects_return_date || statusFlags?.is_blacklist)) { openStatusEdit(); return }
    const it = statuses.find(s => s.value === v) as (LookupOption & { requires_match?: unknown; requires_reason?: unknown; expects_return_date?: unknown; is_blacklist?: unknown }) | undefined
    if (it?.requires_match) { placed.setMatchChoice(null); placed.setMatchPrompt(true); return }
    if (Boolean(it?.requires_reason) || Boolean(it?.expects_return_date)) {
      setStatusModal({ target: v, reason: '', date: '', needReason: Boolean(it?.requires_reason), needDate: Boolean(it?.expects_return_date), isBlacklist: Boolean(it?.is_blacklist) })
      return
    }
    setStatus(v); onUpdate?.(c.id, { status: v })
  }

  // Confirm a reason/return-date change. Blacklist carries the lookup-backed
  // blacklist_reason (BE guard validates); other statuses use free-text status_reason.
  const confirmStatus = () => {
    if (!statusModal || !c) return
    setStatus(statusModal.target)
    const reasonPatch = statusModal.isBlacklist
      ? { blacklistReason: statusModal.reason || null }
      : { statusReason: statusModal.reason || null }
    const changed = statusModal.target !== c.status
    // STATUS-DATE-SYNC-1: the server makes the return date THE availability-from
    // (one truth). Mirror that optimistically so the Voorkeuren "Inzetbaar vanaf"
    // field updates within the same drawer session (verified gap 2026-07-08:
    // banner showed the new date while the field still held the old one).
    const prefPatch = statusModal.date
      ? { preferences: { ...((c.preferences as Record<string, unknown>) ?? {}), available_from: statusModal.date } }
      : {}
    // Editing the CURRENT status (banner pencil / timeline pencil, Danny 2026-07-20:
    // "potlood op de statuswissel") only touches reason/date — omit `status` and
    // `statusChangedAt` from the patch so an unchanged status never re-fires as a
    // "status changed" signal. N-1: the status note is written CENTRALLY by the
    // backend guard on an ACTUAL status-changing PATCH.
    onUpdate?.(c.id, { ...(changed ? { status: statusModal.target, statusChangedAt: new Date().toISOString() } : {}),
      ...reasonPatch, statusReturnDate: statusModal.date || null, ...prefPatch })
    setStatusModal(null)
  }

  return {
    statuses, currentPhase, phaseInfo, nextPhase, isEntryPhase, converting, doConvert,
    currentStatus, showStatus, openStatusEdit, canEditStatusReason, changeStatus,
    statusModal, setStatusModal, confirmStatus,
    ...placed,
  }
}
