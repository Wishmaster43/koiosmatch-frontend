/**
 * useAddVacancyLookups — the tenant lookups + derived option lists for the
 * "+ Vacature" create form: every useX() lookup hook, the AI-agent/attachment
 * gating (module+permission), the tenant application-settings defaults, and
 * the memoised <select> option lists built from them. Extracted verbatim
 * (§3 size split, > ~400-line trigger) out of useAddVacancyForm — behaviour
 * unchanged, only wired through explicit params/returns instead of closure.
 */
import { useMemo } from 'react'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useLookups } from '@/context/LookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useLocations } from '@/lib/useLocations'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS } from '../data/applicationSettingsDefaults'
import { useAiAgents } from '../hooks/useAiAgents'
import type { Id } from '@/types/common'

interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

interface Args {
  users: ModalUser[]
  customers: ModalCustomer[]
}

// Owns every tenant lookup, the AI-agent/attachment gating and the derived
// <select> option lists the "+ Vacature" form needs.
export function useAddVacancyLookups({ users, customers }: Args) {
  const { statuses, seniorityLevels, educationLevels, defaultSeniority, defaultEducation, channels: channelLookup } = useVacancyLookups()
  // Contract types are a CANDIDATE-axis lookup (Contractvorm), shared with the
  // drawer's DetailsGeneralTab — same source, never a second copy.
  const { candidateTypes } = useLookups() as unknown as { candidateTypes: Array<{ value: string; label: string; color?: string }> }
  const { industries } = useIndustries()
  const { functions } = useFunctions()
  // Memoised: derived from the shared locations lookup, only recomputed when it changes.
  const locationsRaw = useLocations()
  const branchOptions = useMemo(() => locationsRaw.map(l => ({ value: String(l.value), label: l.label })), [locationsRaw])
  const authCtx = useAuth() as unknown as {
    user: { id?: Id; name?: string } | null
    hasModule?: (key: string) => boolean
    hasPermission?: (perm: string) => boolean
  }
  const { user: me, hasModule, hasPermission } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))

  // Punt 19: the AI-agent card only exists for a tenant with the module AND a
  // caller with settings.view (GET /ai/agents is gated on both, measured) —
  // rendered as NOTHING when either is missing, never a disabled tease (§3).
  const showAiAgentCard = (hasModule?.('aiagents') ?? false) && (hasPermission?.('settings.view') ?? false)
  // Punten 21+22: both POST .../documents and POST .../notes need vacancies.update
  // next to vacancies.create (measured) — the attachment cards gate on that.
  const showAttachmentCards = hasPermission?.('vacancies.update') ?? false

  // Punt 20: seed the vacancy owner's own linked AI agent (agent.user.id ===
  // ownerId), empty when the owner has none — a Koios-marked derivation, never
  // a silent guess (§0). Only fetched while the card can actually show.
  const { agents: aiAgents } = useAiAgents(showAiAgentCard)

  // Punt 20: Publicatie — the application-form settings tenant defaults.
  const allSettings = useAllSettings()
  // Memoized on the RAW stored value (a stable string/undefined), not recomputed every
  // render: getJsonSetting JSON.parses a configured setting into a NEW object each call,
  // which would otherwise hand the effect below an unstable dependency and loop forever
  // (measured — an unstable mock reference reproduced this exact hang in tests).
  const rawAppDefaults = (allSettings as Record<string, unknown>)[VACANCY_APP_DEFAULTS_KEY]
  // Parse the tenant's application-form defaults, re-parsing only when the raw
  // stored value itself changes (see the comment above for why that matters).
  const tenantAppDefaults = useMemo(
    () => getJsonSetting<Record<string, unknown>>(allSettings, VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS),
    [rawAppDefaults], // eslint-disable-line react-hooks/exhaustive-deps -- allSettings is a stable cache object; only this one key's raw value should force a re-parse
  )

  // Owner options: make sure the logged-in default is actually IN the list (a
  // super admin isn't always in the assignable list — mirrors AddCandidateModal).
  // Memoised: the caller-owned super admin fallback insert must stay stable, not re-derived every render.
  const userOptions = useMemo(() => {
    const opts = users.map(u => ({ value: String(u.id), label: u.name }))
    if (me?.id && !opts.some(o => o.value === String(me.id))) {
      opts.unshift({ value: String(me.id), label: me.name ?? '' })
    }
    return opts
  }, [users, me])
  // Memoised: status option list only changes with the tenant lookup.
  const statusOptions = useMemo(() => statuses.map(s => ({ value: s.value, label: s.label, color: s.color })), [statuses])
  // Memoised: customer option list only changes with the caller-supplied customers.
  const customerOptions = useMemo(() => customers.map(c => ({ value: String(c.id), label: c.name })), [customers])

  return {
    me, meIsAssignable,
    statuses, seniorityLevels, educationLevels, defaultSeniority, defaultEducation, channelLookup,
    candidateTypes, industries, functions, branchOptions,
    showAiAgentCard, showAttachmentCards, aiAgents,
    tenantAppDefaults,
    userOptions, statusOptions, customerOptions,
  }
}
