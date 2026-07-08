/**
 * useCandidateStatus — the phase/status axis logic of the candidate drawer
 * (§0.3 split from CandidateDrawer): phase badge + convert, deployability
 * changes driven by the status-lookup flags (requires_match → link a Match,
 * requires_reason / expects_return_date → prompt first), and the human-readable
 * status info line. Pure logic + modal state; rendering stays in the drawer.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import { useCreateMatch } from './useCreateMatch'
import { useVacancyOptions } from './useVacancyOptions'
import { buildStatusInfoLine, makeRequiredComplete } from '../drawer/candidateStatusInfo'
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
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null, opts?: Intl.DateTimeFormatOptions) => string }
  const { phases, statuses, phaseMeta, statusMeta } = useLookups() as unknown as {
    phases: LookupOption[]; statuses: LookupOption[]
    phaseMeta: (v?: string | null) => { label: string; color: string }
    statusMeta: (v?: string | null) => { label: string; color: string }
  }
  const allSettings = useAllSettings()
  const { createMatch, creating: creatingMatch } = useCreateMatch(c?.id ?? '')

  // Optimistic overrides + the two prompts (placed→match, reason/date).
  const [phase,  setPhase]  = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [matchPrompt,       setMatchPrompt]       = useState(false)
  const [matchChoice,       setMatchChoice]       = useState<string | null>(null)
  const [newMatchVacancyId, setNewMatchVacancyId] = useState('')
  const [statusModal,       setStatusModal]       = useState<StatusModalState | null>(null)
  // Convert guard — blocks an accidental CV click right after converting.
  const [converting,        setConverting]        = useState(false)
  // Vacancy picker options — only fetched while the placed prompt is open.
  const vacancyOptions = useVacancyOptions(matchPrompt)

  // Reset the overrides when a different candidate is shown (render-time state adjust).
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setPhase(null); setStatus(null); setMatchPrompt(false); setMatchChoice(null); setStatusModal(null); setConverting(false)
  }

  const currentPhase = phase ?? c?.phase
  const changePhase = (v: string) => { if (!c) return; setPhase(v); onUpdate?.(c.id, { phase: v }) }
  // Fase: colour-coded read-only badge (no picker); "convert" advances the entry (first) phase.
  const phaseInfo    = phaseMeta(currentPhase)
  const phaseIdx     = phases.findIndex(p => p.value === currentPhase)
  const nextPhase    = phaseIdx >= 0 ? phases[phaseIdx + 1] : undefined
  const isEntryPhase = phaseIdx === 0

  // Convert to the next phase; jump to Profile-edit unless its required fields are complete.
  const doConvert = (setActiveTab?: (id: string) => void) => {
    if (!nextPhase || !c) return
    changePhase(nextPhase.value)
    setConverting(true); setTimeout(() => setConverting(false), 1000)
    const requiredComplete = makeRequiredComplete(c, allSettings)
    if (!requiredComplete(nextPhase.value)) onConvertIncomplete?.(setActiveTab)
  }

  const currentStatus = status ?? c?.status
  // Deployability only applies once someone is a Kandidaat — a Lead isn't deployable yet.
  const showStatus = !!currentPhase && !isEntryPhase
  // Flag-driven info line (§3B): blacklist reason, or reason + "available again" date.
  const statusFlags = statuses.find(s => s.value === currentStatus) as StatusFlags
  const statusInfoLine = ((c && currentStatus) ? buildStatusInfoLine({ c, statusFlags, currentStatus, statusMeta, t, formatDate }) : '') ?? ''

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
  const changeStatus = (v: string) => {
    if (!c) return
    const it = statuses.find(s => s.value === v) as (LookupOption & { requires_match?: unknown; requires_reason?: unknown; expects_return_date?: unknown; is_blacklist?: unknown }) | undefined
    if (it?.requires_match) { setMatchChoice(null); setMatchPrompt(true); return }
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
    // N-1: the status note is written CENTRALLY by the backend guard on this PATCH.
    onUpdate?.(c.id, { status: statusModal.target, ...reasonPatch, statusReturnDate: statusModal.date || null,
      ...(changed ? { statusChangedAt: new Date().toISOString() } : {}) })
    setStatusModal(null)
  }

  // Confirm the "Placed" prompt: use the picked match, or create one for the chosen vacancy.
  const confirmPlacedMatch = async () => {
    if (!c) return
    let mid = matchChoice
    if (!mid && newMatchVacancyId) mid = await createMatch(newMatchVacancyId)
    if (!mid) return
    setStatus('placed'); onUpdate?.(c.id, { status: 'placed', match_id: mid })
    setMatchPrompt(false); setMatchChoice(null); setNewMatchVacancyId('')
  }

  return {
    statuses, currentPhase, phaseInfo, nextPhase, isEntryPhase, converting, doConvert,
    currentStatus, showStatus, statusInfoLine, openStatusEdit, changeStatus,
    statusModal, setStatusModal, confirmStatus,
    matchPrompt, setMatchPrompt, matchChoice, setMatchChoice,
    newMatchVacancyId, setNewMatchVacancyId, vacancyOptions, creatingMatch, confirmPlacedMatch,
  }
}
