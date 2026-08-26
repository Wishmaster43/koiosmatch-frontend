/* eslint-disable react-refresh/only-export-components -- a context module exports its provider and its hooks together by design (§2: contexts live in context/); moving the hooks would change every consumer import for a dev-only HMR nicety */
import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '../lib/api'
import { sortActiveRows, makeMetaResolver } from '../lib/lookupUtils'
import { translateSeedList } from '../lib/lookupSeedI18n'

/**
 * VacancyLookupsContext — the tenant-configurable vacancy lookups.
 *
 * Mirrors LookupsContext (the candidate axes) but for the vacancy domain and is
 * mounted *page-scoped* around VacanciesPage, not app-wide: these lists are only
 * needed on the vacancies screen + its settings, so there's no global overhead.
 *
 * Lists (each a tenant-managed Settings lookup, never a hardcoded enum):
 *   statuses        — vacancy lifecycle status, single value + colour (Open/Concept/…).
 *   phases          — the application funnel phases shown as KPIs/breakdown on a vacancy.
 *   seniorityLevels — Starter/Medior/Professional/Senior.
 *   educationLevels — VMBO/MBO/HBO/WO.
 *   channels        — job boards to publish on (career page/Google Jobs/Indeed/…).
 */

// One configurable vacancy lookup row.
// `is_default` is the backend's singleton flag (DEFAULTS-1, V11/V19) on the
// seniority + education lookups — the tenant's proposed value for an empty field.
// `active`/`default_enabled` (CHANNEL-FLAGS-1, round-4 audit finding #3) are
// channel-only: whether the job board is still offered, and whether a new
// vacancy's publish panel pre-checks it (PublishingTab reads both).
export interface VacancyLookupItem { value: string; label: string; color?: string; is_default?: boolean; active?: boolean; default_enabled?: boolean; [k: string]: unknown }

interface VacancyLookupsValue {
  statuses: VacancyLookupItem[]
  phases: VacancyLookupItem[]
  seniorityLevels: VacancyLookupItem[]
  educationLevels: VacancyLookupItem[]
  channels: VacancyLookupItem[]
  loading: boolean
  statusMeta: (v?: string | null) => VacancyLookupItem
  phaseMeta: (v?: string | null) => VacancyLookupItem
  seniorityMeta: (v?: string | null) => VacancyLookupItem
  educationMeta: (v?: string | null) => VacancyLookupItem
  // The tenant's flagged default value ('' when none is flagged) — a PROPOSAL for
  // an empty field, never an index-0 guess, so an unconfigured tenant keeps "—".
  defaultSeniority: string
  defaultEducation: string
}

// ── Seed defaults (English slugs, tenant-editable labels/colours) ─────────────

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_VACANCY_STATUSES: VacancyLookupItem[] = [
  { value: 'open',    label: 'Open',       color: '#79B58E' },
  { value: 'online',  label: 'Online',     color: '#6E8FD6' },
  { value: 'concept', label: 'Concept',    color: '#94A3B8' },
  { value: 'paused',  label: 'Gepauzeerd', color: '#C9AC64' },
  { value: 'closed',  label: 'Gesloten',   color: '#8A94A6' },
]
/* eslint-enable no-restricted-syntax */

// Application funnel phases — the KPI cards + the breakdown on a vacancy.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_VACANCY_PHASES: VacancyLookupItem[] = [
  { value: 'applied',  label: 'Gesolliciteerd', color: '#94A3B8' },
  { value: 'accepted', label: 'Geaccepteerd',   color: '#8C86D9' },
  { value: 'invited',  label: 'Uitgenodigd',    color: '#6FA8C4' },
  { value: 'proposed', label: 'Voorstel gedaan', color: '#DDA071' },
  { value: 'hired',    label: 'Aangenomen',     color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',      color: '#D98A8A' },
]
/* eslint-enable no-restricted-syntax */

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_SENIORITY_LEVELS: VacancyLookupItem[] = [
  { value: 'starter',      label: 'Starter',      color: '#94A3B8' },
  { value: 'medior',       label: 'Medior',       color: '#6FA8C4' },
  { value: 'professional', label: 'Professional', color: '#79B58E' },
  { value: 'senior',       label: 'Senior',       color: '#A98AD1' },
]
/* eslint-enable no-restricted-syntax */

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_EDUCATION_LEVELS: VacancyLookupItem[] = [
  { value: 'vmbo', label: 'VMBO', color: '#94A3B8' },
  { value: 'mbo',  label: 'MBO',  color: '#6FA8C4' },
  { value: 'hbo',  label: 'HBO',  color: '#79B58E' },
  { value: 'wo',   label: 'WO',   color: '#A98AD1' },
]
/* eslint-enable no-restricted-syntax */

// Job boards. `value` is the stable slug; `published` state lives per vacancy.
const DEFAULT_CHANNELS: VacancyLookupItem[] = [
  { value: 'career',     label: 'Carrière-pagina' },
  { value: 'google',     label: 'Google Jobs' },
  { value: 'indeed',     label: 'Indeed' },
  { value: 'werkzoeken', label: 'Werkzoeken' },
]

// Tolerant truthy check — the backend may send a real bool, 1/0 or "true"/"false"
// (mirrors TaskLookupsContext; Laravel serialises tinyint flags inconsistently).
const truthy = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
// `pinId` (channels only): the publish toggle persists channel_id (uuid) per
// vacancy, so the value must STAY the id — CHANNEL-KEY-1 adds a `key` column
// server-side and the generic `value ?? key ?? id` chain would silently flip
// stored references from uuid to key the moment that merges (CMBE 15-07).
// `is_default` is carried through (DEFAULTS-1): dropping it here is what made the
// Settings default-toggle unreadable by any consumer. `active`/`default_enabled`
// (CHANNEL-FLAGS-1, round-4 audit finding #3) are carried through the same way —
// PublishingTab needs both to filter a deactivated channel off the publish panel
// and pre-check the tenant's default_enabled ones on a new vacancy. `active` is
// backend boolean-cast (VacancyChannel::$casts) so a plain `!== false` reads it
// correctly; `sortActiveRows` above already dropped any row with active===false,
// so every mapped item's `active` is true here — kept explicit (not hardcoded) so
// the shape stays honest if that upstream filter ever changes, and harmless for
// the non-channel lookups that share this same normalize() (they carry neither
// flag on the wire, so both default to their backend-side defaults). No cast
// exists for `default_enabled` on the backend, so it needs the tolerant `truthy()`
// helper (Laravel may serialise the uncast tinyint as 1/0).
function normalize(raw: unknown, fallback: VacancyLookupItem[], pinId = false): VacancyLookupItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return sortActiveRows(raw)
    .map(it => ({
      value: String((pinId ? it.id : undefined) ?? it.value ?? it.key ?? it.id),
      label: String(it.label ?? it.name ?? it.value ?? it.key),
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
      color: (it.color as string) ?? '#6B7280',
      is_default: truthy(it.is_default),
      active: it.active !== false,
      default_enabled: truthy(it.default_enabled ?? true),
    }))
}

// The tenant's flagged default, or '' — no index-0 fallback on purpose: a tenant
// that flagged nothing must get no proposal at all (§3 no invented behaviour).
const defaultValueOf = (list: VacancyLookupItem[]): string => list.find(i => i.is_default)?.value ?? ''

const VacancyLookupsContext = createContext<VacancyLookupsValue | null>(null)

export function VacancyLookupsProvider({ children }: { children: ReactNode }) {
  // LOOKUP-I18N-1 catalogue's keys live in the 'common' namespace.
  const { t: tCommon } = useTranslation('common')
  const [statusesRaw,        setStatuses]        = useState<VacancyLookupItem[]>(DEFAULT_VACANCY_STATUSES)
  const [phasesRaw,          setPhases]          = useState<VacancyLookupItem[]>(DEFAULT_VACANCY_PHASES)
  const [seniorityLevelsRaw, setSeniorityLevels] = useState<VacancyLookupItem[]>(DEFAULT_SENIORITY_LEVELS)
  const [educationLevelsRaw, setEducationLevels] = useState<VacancyLookupItem[]>(DEFAULT_EDUCATION_LEVELS)
  const [channelsRaw,        setChannels]        = useState<VacancyLookupItem[]>(DEFAULT_CHANNELS)
  const [loading,            setLoading]         = useState(true)

  // Fetch each lookup once; a 404/empty keeps the seed fallback so the UI never breaks.
  useEffect(() => {
    const load = (url: string, fallback: VacancyLookupItem[], set: Dispatch<SetStateAction<VacancyLookupItem[]>>, pinId = false) =>
      api.get(url).then(r => set(normalize(unwrap(r), fallback, pinId))).catch(() => {})
    Promise.allSettled([
      load('/vacancy-statuses',         DEFAULT_VACANCY_STATUSES, setStatuses),
      load('/vacancy-phases',           DEFAULT_VACANCY_PHASES,   setPhases),
      load('/vacancy-seniority-levels', DEFAULT_SENIORITY_LEVELS, setSeniorityLevels),
      load('/vacancy-education-levels', DEFAULT_EDUCATION_LEVELS, setEducationLevels),
      load('/vacancy-channels',         DEFAULT_CHANNELS,         setChannels, true),
    ]).finally(() => setLoading(false))
  }, [])

  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // All five lists route through the shared catalogue (family names below).
  const statuses        = useMemo(() => translateSeedList(tCommon, 'vacancyStatuses', statusesRaw), [statusesRaw, tCommon])
  // Phases render through the funnelTypes seed family (they ARE funnel stages), unlike the other lists' own catalogue names.
  const phases          = useMemo(() => translateSeedList(tCommon, 'funnelTypes', phasesRaw), [phasesRaw, tCommon])
  // Seniority levels get the same translate-or-passthrough treatment as statuses above.
  const seniorityLevels = useMemo(() => translateSeedList(tCommon, 'seniorityLevels', seniorityLevelsRaw), [seniorityLevelsRaw, tCommon])
  // Education levels get the same translate-or-passthrough treatment as statuses above.
  const educationLevels = useMemo(() => translateSeedList(tCommon, 'educationLevels', educationLevelsRaw), [educationLevelsRaw, tCommon])
  const channels         = useMemo(() => translateSeedList(tCommon, 'channels', channelsRaw), [channelsRaw, tCommon])

  // value → item helper with a neutral fallback so the UI never crashes.
  const value: VacancyLookupsValue = {
    statuses, phases, seniorityLevels, educationLevels, channels, loading,
    statusMeta:     makeMetaResolver(statuses),
    phaseMeta:      makeMetaResolver(phases),
    seniorityMeta:  makeMetaResolver(seniorityLevels),
    educationMeta:  makeMetaResolver(educationLevels),
    defaultSeniority: defaultValueOf(seniorityLevels),
    defaultEducation: defaultValueOf(educationLevels),
  }

  return <VacancyLookupsContext.Provider value={value}>{children}</VacancyLookupsContext.Provider>
}

// Consumer hook: throws early outside the provider so a missing wrap fails loudly instead of silently returning undefined lookups.
export function useVacancyLookups(): VacancyLookupsValue {
  const ctx = useContext(VacancyLookupsContext)
  if (!ctx) throw new Error('useVacancyLookups must be used within a VacancyLookupsProvider')
  return ctx
}
