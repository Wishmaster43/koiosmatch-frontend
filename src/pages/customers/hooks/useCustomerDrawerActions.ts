/**
 * useCustomerDrawerActions — the phase/status/owner/tags header wiring, the
 * convert-phase action, the count-sync effects, and the delete/merge actions
 * for CustomerDrawer. Extracted verbatim from CustomerDrawer.tsx (pure
 * extraction — behaviour unchanged); the container still owns tab rendering
 * and JSX composition.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { initialsOf } from '@/lib/initials'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { CustomerBlacklistModalState, BlacklistReasonOption } from '../drawer/CustomerStatusReasonModal'

interface DrawerUser { id: Id; name: string; avatar_color?: string }

interface UseCustomerDrawerActionsArgs {
  // Nullable: this hook is called unconditionally (rules of hooks), same as the
  // useState calls it replaces in the container, BEFORE the container's own
  // `if (!c) return null` guard.
  c: Customer | null
  // STATUS-OVERRIDE-REVERT-1: onUpdate may resolve true/false (saved/rejected) —
  // the status/phase/owner overrides below clear themselves on a rejection.
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void | Promise<boolean>
  onClose: () => void
  users: DrawerUser[]
  statuses: LookupOption[]
}

// Thin container hook: header state (status/phase/owner/tags/name/logo), the
// convert-phase action, count-sync effects wiring is left to the caller (it
// needs the sub-entity API objects), and the delete/merge actions.
export function useCustomerDrawerActions({ c, onUpdate, onClose, users, statuses }: UseCustomerDrawerActionsArgs) {
  const { t } = useTranslation('customers')
  // KLANT-FASE-1: the lifecycle-phase lookup behind the header badge (session-cached).
  const { phases, phaseMeta } = useCustomerPhases()
  // CUSTOMER-DEFAULT-STATUS-1: the tenant settings blob, read the same way
  // useCandidateStatus.ts reads its own (mirrors DEFAULT-STATUS-1) — used by
  // doConvertPhase below to apply the configured default status on convert.
  const allSettings = useAllSettings()
  // KLANT-BLACKLIST-PROMPT-1: whether the blacklist reason is REQUIRED (vs.
  // optional) is a tenant switch, mirrored from the candidate axis's own key;
  // the BE guard reads the same setting (default ON).
  const blacklistReasonRequired = getBoolSetting(allSettings, 'customer_blacklist_reason_required', true)

  // Header overrides — reset when a different customer is shown (during render).
  const [status, setStatus] = useState<string | null>(null)
  // KLANT-FASE-1: local override for the phase picker, same pattern as `status`.
  const [phase,  setPhase]  = useState<string | null>(null)
  const [owner,  setOwner]  = useState<DrawerUser | null>(null)
  const [tags,   setTags]   = useState<string[] | null>(null)
  // Header name edit + logo upload — independent from the Overview-tab fields (mirrors the candidate).
  const [headerEditing, setHeaderEditing] = useState(false)
  const [headerName,    setHeaderName]    = useState('')
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null)
  // KLANT-BLACKLIST-PROMPT-1: the blacklist status-reason prompt (mirrors the
  // candidate axis's statusModal) — set only when the picked status carries
  // `isBlacklist`; the PATCH is deferred to confirmBlacklist below.
  const [blacklistModal, setBlacklistModal] = useState<CustomerBlacklistModalState | null>(null)
  const [blacklistReasons, setBlacklistReasons] = useState<BlacklistReasonOption[]>([])
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) { setPrevId(c?.id); setStatus(null); setPhase(null); setOwner(null); setTags(null); setHeaderEditing(false); setLogoUrl(null); setBlacklistModal(null) }

  // Loads the blacklist-reason tenant lookup once, the first time the prompt opens
  // (mirrors CandidateStatusModals) — the backend validates against these names
  // rather than accepting free text.
  // Keyed on an OPEN boolean plus a loaded ref, never on the modal object: every reason
  // keystroke replaces that object, which re-fired the GET on tenants with an empty lookup.
  const blacklistOpen = Boolean(blacklistModal)
  const blacklistReasonsLoaded = useRef(false)
  useEffect(() => {
    if (!blacklistOpen || blacklistReasonsLoaded.current) return
    let alive = true
    api.get('/customer-blacklist-reasons')
      .then(r => {
        if (!alive) return
        blacklistReasonsLoaded.current = true
        setBlacklistReasons(
          ((unwrapList(r).rows) as Array<{ name?: string }>)
            .filter(x => x.name)
            .map(x => ({ value: String(x.name), label: String(x.name) })),
        )
      })
      .catch(() => { if (alive) { blacklistReasonsLoaded.current = true; setBlacklistReasons([]) } })
    return () => { alive = false }
  }, [blacklistOpen])

  // DELETE-ICON-1: the house confirm dialog (§0 restschuld) — same shared hook the
  // candidate drawer's own trash icon and OpportunitiesTab's delete already use.
  const { confirm, dialog: deleteDialog } = useConfirm()
  // KLANT-SAMENVOEGEN-1: the merge overlay is its own two-step modal (mirrors the
  // candidate's MergeCandidateModal), not the house confirm dialog above.
  const [showMerge, setShowMerge] = useState(false)

  // Enter/save the header name edit; save flows through the optimistic onUpdate.
  const startHeaderEdit = () => { setHeaderName(c?.name ?? ''); setHeaderEditing(true) }
  const saveHeader = () => { if (headerName.trim()) onUpdate?.(c?.id, { name: headerName.trim() }); setHeaderEditing(false) }

  // DELETE-ICON-1: soft-delete this customer (DELETE /customers/{id}, the entity-wide
  // per-record convention, §10) — the backend re-checks live links (§3B) and answers
  // 409 when any still hang on it, mapped to i18n rather than shown as raw server text.
  // Flags `archived` locally (never a stray PATCH — 'archived' isn't in
  // useCustomerRecord's FIELD_MAP, mirrors the locationsCount bumps above) so the
  // page's existing archived-view filter hides the row immediately, then closes.
  const requestDelete = () => {
    if (!c) return
    confirm(t('drawer.deleteConfirm', { name: c.name }), () => {
      api.delete(`/customers/${c.id}`).then(() => {
        notifySuccess(t('drawer.deletedNamed', { name: c.name }))
        onUpdate?.(c.id, { archived: true })
        onClose()
      }).catch(err => {
        const status = (err as { response?: { status?: number } })?.response?.status
        notifyError(t(status === 409 ? 'drawer.deleteBlocked' : 'drawer.deleteFailed', { name: c.name }))
      })
    }, { danger: true })
  }

  const currentStatus = status ?? c?.status
  const currentTags   = tags ?? (c?.tags as string[]) ?? []
  // KLANT-BLACKLIST-PROMPT-1: a status flagged `isBlacklist` opens the reason
  // prompt instead of patching immediately — status AND blacklist_reason travel
  // in ONE PATCH (the BE guard validates the transition together with the
  // reason). Every other status clears the blacklist reason (send null) so no
  // stale reason stays on file when the customer leaves the blacklist.
  const changeStatus  = (v: string) => {
    const picked = statuses.find(s => String(s.value) === v)
    if (picked?.isBlacklist) {
      setBlacklistModal({ target: v, reason: (c?.blacklistReason ?? ''), needReason: blacklistReasonRequired })
      return
    }
    setStatus(v)
    // STATUS-OVERRIDE-REVERT-1: clear the override on a rejected PATCH so the
    // picker falls back to the (reverted) record value instead of the refused one.
    Promise.resolve(onUpdate?.(c?.id, { status: v, blacklistReason: null })).then(ok => { if (ok === false) setStatus(null) })
  }
  // Confirm the blacklist prompt: one PATCH carrying both the new status and the
  // reason. Cancel (closing without confirming) never patches — the picker keeps
  // showing the unchanged status.
  const confirmBlacklist = () => {
    if (!blacklistModal || !c) return
    // Local override mirrors changeStatus above: updateCustomer reverts the record slices on
    // a rejected PATCH, and now clears this override too (STATUS-OVERRIDE-REVERT-1).
    setStatus(blacklistModal.target)
    Promise.resolve(onUpdate?.(c.id, { status: blacklistModal.target, blacklistReason: blacklistModal.reason || null }))
      .then(ok => { if (ok === false) setStatus(null) })
    setBlacklistModal(null)
  }
  // KLANT-FASE-1: phase is its own axis next to status — shown as a read-only badge
  // (KLANT-FASE-CONVERT-1 below), backed by the `phase` column (PATCH /customers/{id}).
  const currentPhase  = phase ?? c?.phase
  const phaseInfo     = phaseMeta(currentPhase)
  // Danny 02-08: "Prospect heeft geen status" — mirrors the candidate drawer's
  // showStatus gate (useCandidateStatus.ts): a customer still in the ENTRY phase
  // isn't deployable yet, so the Status picker doesn't show at all. Resolved via
  // the `is_default` FLAG (never an array position — see CustomerStatusChip for
  // why that matters), so reordering the phase lookup in Settings never misfires.
  const entryPhaseValue = phases.find(p => p.isDefault)?.value
  const showStatus = !!currentPhase && currentPhase !== entryPhaseValue
  // KLANT-FASE-CONVERT-1 (Danny 02-08): "convert prospect to customer" mirrors the
  // candidate's Lead → Candidate convert (§3A(c)) — a read-only phase badge next to
  // the name (see renderTitle below) plus a one-click convert button in the header,
  // no picker, no confirm. Target = the phase flagged `isCustomer`, NEVER an array
  // position: the customer phase lookup carries real behaviour flags (§3B), unlike
  // the candidate hook's index-based `phases[phaseIdx + 1]`. No isCustomer option
  // configured on the tenant's lookup → render no convert button at all (a convert
  // into an unknown phase is worse than none).
  const targetPhase = phases.find(p => p.isCustomer)
  const isEntryPhase = !!entryPhaseValue && currentPhase === entryPhaseValue
  // CUSTOMER-DEFAULT-STATUS-1 (Danny 2026-08-03): mirrors the candidate convert
  // (DEFAULT-STATUS-1, useCandidateStatus.ts) — a Prospect converting to Klant
  // gets the tenant's configured default status in the SAME patch as the phase,
  // but ONLY when the customer has no status yet. Unlike the candidate axis, an
  // absent setting (or one pointing at a since-deleted status) leaves the status
  // untouched — 'none' is the honest default here (today's behaviour), never a
  // guessed real value. KLANT-BLACKLIST-PROMPT-1: unlike doConvert's own default
  // this convert path never applies a blacklist default (`def` is a tenant
  // setting, never a stray "blacklist" slug), so no extra guard is needed here.
  const doConvertPhase = () => {
    if (!targetPhase || !c) return
    const patch: Record<string, unknown> = { phase: targetPhase.value }
    const defRaw = (allSettings as Record<string, unknown> | null)?.['customer_default_status_on_convert']
    const def = typeof defRaw === 'string' ? defRaw : 'none'
    const wantsDefault = !(status ?? c.status) && def !== 'none' && statuses.some(s => s.value === def)
    if (wantsDefault) { setStatus(def); patch.status = def }
    setPhase(targetPhase.value)
    // STATUS-OVERRIDE-REVERT-1: a rejected PATCH must clear both local overrides
    // this convert set, so the badge falls back to the (reverted) record value.
    Promise.resolve(onUpdate?.(c.id, patch)).then(ok => {
      if (ok === false) {
        setPhase(null)
        if (wantsDefault) setStatus(null)
      }
    })
  }

  // Owner (account manager) picker — a fallback entry ONLY when the current
  // owner is not in the selectable `users` list (always prepending it duplicated
  // the account manager in the dropdown — Danny 2026-07-14, same bug fixed on
  // the candidate drawer, commit 9147ea6; mirrored here).
  const currentOwnerId = owner?.id ?? c?.ownerId
  const ownerInUsers = currentOwnerId != null && users.some(u => String(u.id) === String(currentOwnerId))
  const ownerOptions = [
    ...(ownerInUsers || !c?.owner ? [] : [{ value: '__current', label: owner?.name ?? c?.owner ?? '—', initials: owner ? initialsOf(owner.name) : c?.ownerInitials }]),
    ...users.map(u => ({ value: String(u.id), label: u.name, initials: initialsOf(u.name) })),
  ]
  const ownerValue = ownerInUsers ? String(currentOwnerId) : '__current'
  // Picking a real owner also caches their display fields locally so the header
  // renders instantly without waiting on a refetch; the '__current' fallback sentinel is a no-op.
  const onOwnerChange = (id: string) => {
    if (id === '__current') return
    const u = users.find(x => String(x.id) === id)
    if (!u) return
    setOwner({ ...u })
    // STATUS-OVERRIDE-REVERT-1: clear the override on a rejected PATCH so the
    // picker falls back to the (reverted) record's owner instead of the refused one.
    Promise.resolve(onUpdate?.(c?.id, { ownerId: u.id, owner: u.name, ownerInitials: initialsOf(u.name), ownerColor: u.avatar_color ?? null }))
      .then(ok => { if (ok === false) setOwner(null) })
  }

  return {
    currentStatus, currentTags, changeStatus,
    currentPhase, phaseInfo, showStatus,
    targetPhase, isEntryPhase, doConvertPhase,
    ownerOptions, ownerValue, onOwnerChange,
    headerEditing, headerName, setHeaderName, startHeaderEdit, saveHeader, setHeaderEditing,
    logoUrl, setLogoUrl,
    requestDelete, deleteDialog,
    showMerge, setShowMerge,
    setTags,
    // KLANT-BLACKLIST-PROMPT-1: the blacklist status-reason prompt state + actions.
    blacklistModal, setBlacklistModal, confirmBlacklist, blacklistReasons,
  }
}
