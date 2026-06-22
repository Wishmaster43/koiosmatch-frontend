import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { COOKIE_AUTH } from '../lib/authMode'

/**
 * VacancyLookupsContext — the tenant-configurable vacancy lookups.
 *
 * Mirrors LookupsContext (the candidate axes) but for the vacancy domain and is
 * mounted *page-scoped* around VacanciesPage, not app-wide: these lists are only
 * needed on the vacancies screen + its settings, so there's no global overhead.
 *
 * Lists (each a tenant-managed Settings lookup, never a hardcoded enum):
 *   statuses        — vacancy lifecycle status, single value + colour (Open/Concept/…).
 *   phases          — the application funnel phases shown as KPIs/breakdown on a vacancy
 *                     (applied → accepted → invited → proposed → hired → rejected).
 *   employmentTypes — "soort dienstverband" (Tijdelijk/Vast/Oproep/ZZP/Uitzend).
 *   seniorityLevels — Starter/Medior/Professional/Senior.
 *   educationLevels — VMBO/MBO/HBO/WO.
 *   channels        — job boards to publish on (career page/Google Jobs/Indeed/…).
 *
 * The defaults below are the seed shipped for new tenants and the fallback while
 * the API call is in flight / before the backend is ready (see worklist C-26).
 */

// ── Seed defaults (English slugs, tenant-editable labels/colours) ─────────────

// Not exported (no external consumer) so it doesn't add a react-refresh warning;
// the page/drawer read these through useVacancyLookups(), never the seed directly.
const DEFAULT_VACANCY_STATUSES = [
  { value: 'open',    label: 'Open',       color: '#79B58E' },
  { value: 'concept', label: 'Concept',    color: '#94A3B8' },
  { value: 'paused',  label: 'Gepauzeerd', color: '#C9AC64' },
  { value: 'closed',  label: 'Gesloten',   color: '#8A94A6' },
]

// Application funnel phases — the KPI cards + the breakdown on a vacancy. Mirrors
// the applications namespace so the counts line up across the two features.
const DEFAULT_VACANCY_PHASES = [
  { value: 'applied',  label: 'Gesolliciteerd', color: '#94A3B8' },
  { value: 'accepted', label: 'Geaccepteerd',   color: '#8C86D9' },
  { value: 'invited',  label: 'Uitgenodigd',    color: '#6FA8C4' },
  { value: 'proposed', label: 'Voorstel gedaan', color: '#DDA071' },
  { value: 'hired',    label: 'Aangenomen',     color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',      color: '#D98A8A' },
]

const DEFAULT_EMPLOYMENT_TYPES = [
  { value: 'temporary',  label: 'Tijdelijk',     color: '#6E8FD6' },
  { value: 'permanent',  label: 'Vast',          color: '#5FB0AC' },
  { value: 'on_call',    label: 'Oproep',        color: '#A98AD1' },
  { value: 'freelance',  label: 'ZZP',           color: '#DDA071' },
  { value: 'temp_agency', label: 'Uitzend',      color: '#6FA8C4' },
]

const DEFAULT_SENIORITY_LEVELS = [
  { value: 'starter',      label: 'Starter',      color: '#94A3B8' },
  { value: 'medior',       label: 'Medior',       color: '#6FA8C4' },
  { value: 'professional', label: 'Professional', color: '#79B58E' },
  { value: 'senior',       label: 'Senior',       color: '#A98AD1' },
]

const DEFAULT_EDUCATION_LEVELS = [
  { value: 'vmbo', label: 'VMBO', color: '#94A3B8' },
  { value: 'mbo',  label: 'MBO',  color: '#6FA8C4' },
  { value: 'hbo',  label: 'HBO',  color: '#79B58E' },
  { value: 'wo',   label: 'WO',   color: '#A98AD1' },
]

// Job boards. `key` is the stable slug; `published` state lives per vacancy.
const DEFAULT_CHANNELS = [
  { value: 'career',     label: 'Carrière-pagina' },
  { value: 'google',     label: 'Google Jobs' },
  { value: 'indeed',     label: 'Indeed' },
  { value: 'werkzoeken', label: 'Werkzoeken' },
]

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
function normalize(raw, fallback) {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw
    .filter(it => it.active !== false)
    .sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0))
    .map(it => ({
      value: it.value ?? it.key ?? it.id,
      label: it.label ?? it.name ?? it.value ?? it.key,
      color: it.color ?? '#6B7280',
    }))
}

const VacancyLookupsContext = createContext(null)

export function VacancyLookupsProvider({ children }) {
  const [statuses,        setStatuses]        = useState(DEFAULT_VACANCY_STATUSES)
  const [phases,          setPhases]          = useState(DEFAULT_VACANCY_PHASES)
  const [employmentTypes, setEmploymentTypes] = useState(DEFAULT_EMPLOYMENT_TYPES)
  const [seniorityLevels, setSeniorityLevels] = useState(DEFAULT_SENIORITY_LEVELS)
  const [educationLevels, setEducationLevels] = useState(DEFAULT_EDUCATION_LEVELS)
  const [channels,        setChannels]        = useState(DEFAULT_CHANNELS)
  const [loading,         setLoading]         = useState(true)

  // Fetch each lookup once; a 404/empty keeps the seed fallback so the UI never breaks.
  useEffect(() => {
    if (!COOKIE_AUTH && !localStorage.getItem('auth_token')) { setLoading(false); return }
    const load = (url, fallback, set) =>
      api.get(url).then(r => set(normalize(r.data?.data ?? r.data, fallback))).catch(() => {})
    Promise.allSettled([
      load('/vacancy-statuses',         DEFAULT_VACANCY_STATUSES, setStatuses),
      load('/vacancy-phases',           DEFAULT_VACANCY_PHASES,   setPhases),
      load('/vacancy-employment-types', DEFAULT_EMPLOYMENT_TYPES, setEmploymentTypes),
      load('/vacancy-seniority-levels', DEFAULT_SENIORITY_LEVELS, setSeniorityLevels),
      load('/vacancy-education-levels', DEFAULT_EDUCATION_LEVELS, setEducationLevels),
      load('/vacancy-channels',         DEFAULT_CHANNELS,         setChannels),
    ]).finally(() => setLoading(false))
  }, [])

  // value → item helper with a neutral fallback so the UI never crashes.
  const metaIn = (list) => (v) => list.find(i => i.value === v) ?? { value: v, label: v, color: '#9CA3AF' }

  return (
    <VacancyLookupsContext.Provider value={{
      statuses, phases, employmentTypes, seniorityLevels, educationLevels, channels, loading,
      statusMeta:     metaIn(statuses),
      phaseMeta:      metaIn(phases),
      employmentMeta: metaIn(employmentTypes),
      seniorityMeta:  metaIn(seniorityLevels),
      educationMeta:  metaIn(educationLevels),
    }}>
      {children}
    </VacancyLookupsContext.Provider>
  )
}

export function useVacancyLookups() {
  const ctx = useContext(VacancyLookupsContext)
  if (!ctx) throw new Error('useVacancyLookups must be used within a VacancyLookupsProvider')
  return ctx
}
