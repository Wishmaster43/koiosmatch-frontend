import { createContext, useContext, useState, useEffect } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import api, { unwrap } from '../lib/api'
import { sortActiveRows, makeMetaResolver } from '../lib/lookupUtils'

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

// One configurable vacancy lookup row (channels carry no colour).
export interface VacancyLookupItem { value: string; label: string; color?: string; [k: string]: unknown }

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
}

// ── Seed defaults (English slugs, tenant-editable labels/colours) ─────────────

const DEFAULT_VACANCY_STATUSES: VacancyLookupItem[] = [
  { value: 'open',    label: 'Open',       color: '#79B58E' },
  { value: 'online',  label: 'Online',     color: '#6E8FD6' },
  { value: 'concept', label: 'Concept',    color: '#94A3B8' },
  { value: 'paused',  label: 'Gepauzeerd', color: '#C9AC64' },
  { value: 'closed',  label: 'Gesloten',   color: '#8A94A6' },
]

// Application funnel phases — the KPI cards + the breakdown on a vacancy.
const DEFAULT_VACANCY_PHASES: VacancyLookupItem[] = [
  { value: 'applied',  label: 'Gesolliciteerd', color: '#94A3B8' },
  { value: 'accepted', label: 'Geaccepteerd',   color: '#8C86D9' },
  { value: 'invited',  label: 'Uitgenodigd',    color: '#6FA8C4' },
  { value: 'proposed', label: 'Voorstel gedaan', color: '#DDA071' },
  { value: 'hired',    label: 'Aangenomen',     color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',      color: '#D98A8A' },
]

const DEFAULT_SENIORITY_LEVELS: VacancyLookupItem[] = [
  { value: 'starter',      label: 'Starter',      color: '#94A3B8' },
  { value: 'medior',       label: 'Medior',       color: '#6FA8C4' },
  { value: 'professional', label: 'Professional', color: '#79B58E' },
  { value: 'senior',       label: 'Senior',       color: '#A98AD1' },
]

const DEFAULT_EDUCATION_LEVELS: VacancyLookupItem[] = [
  { value: 'vmbo', label: 'VMBO', color: '#94A3B8' },
  { value: 'mbo',  label: 'MBO',  color: '#6FA8C4' },
  { value: 'hbo',  label: 'HBO',  color: '#79B58E' },
  { value: 'wo',   label: 'WO',   color: '#A98AD1' },
]

// Job boards. `value` is the stable slug; `published` state lives per vacancy.
const DEFAULT_CHANNELS: VacancyLookupItem[] = [
  { value: 'career',     label: 'Carrière-pagina' },
  { value: 'google',     label: 'Google Jobs' },
  { value: 'indeed',     label: 'Indeed' },
  { value: 'werkzoeken', label: 'Werkzoeken' },
]

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
// `pinId` (channels only): the publish toggle persists channel_id (uuid) per
// vacancy, so the value must STAY the id — CHANNEL-KEY-1 adds a `key` column
// server-side and the generic `value ?? key ?? id` chain would silently flip
// stored references from uuid to key the moment that merges (CMBE 15-07).
function normalize(raw: unknown, fallback: VacancyLookupItem[], pinId = false): VacancyLookupItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return sortActiveRows(raw)
    .map(it => ({
      value: String((pinId ? it.id : undefined) ?? it.value ?? it.key ?? it.id),
      label: String(it.label ?? it.name ?? it.value ?? it.key),
      color: (it.color as string) ?? '#6B7280',
    }))
}

const VacancyLookupsContext = createContext<VacancyLookupsValue | null>(null)

export function VacancyLookupsProvider({ children }: { children: ReactNode }) {
  const [statuses,        setStatuses]        = useState<VacancyLookupItem[]>(DEFAULT_VACANCY_STATUSES)
  const [phases,          setPhases]          = useState<VacancyLookupItem[]>(DEFAULT_VACANCY_PHASES)
  const [seniorityLevels, setSeniorityLevels] = useState<VacancyLookupItem[]>(DEFAULT_SENIORITY_LEVELS)
  const [educationLevels, setEducationLevels] = useState<VacancyLookupItem[]>(DEFAULT_EDUCATION_LEVELS)
  const [channels,        setChannels]        = useState<VacancyLookupItem[]>(DEFAULT_CHANNELS)
  const [loading,         setLoading]         = useState(true)

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

  // value → item helper with a neutral fallback so the UI never crashes.
  const value: VacancyLookupsValue = {
    statuses, phases, seniorityLevels, educationLevels, channels, loading,
    statusMeta:     makeMetaResolver(statuses),
    phaseMeta:      makeMetaResolver(phases),
    seniorityMeta:  makeMetaResolver(seniorityLevels),
    educationMeta:  makeMetaResolver(educationLevels),
  }

  return <VacancyLookupsContext.Provider value={value}>{children}</VacancyLookupsContext.Provider>
}

export function useVacancyLookups(): VacancyLookupsValue {
  const ctx = useContext(VacancyLookupsContext)
  if (!ctx) throw new Error('useVacancyLookups must be used within a VacancyLookupsProvider')
  return ctx
}
