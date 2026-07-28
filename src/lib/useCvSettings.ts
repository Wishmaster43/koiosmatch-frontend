/**
 * useCvSettings — CV branding + section configuration, tenant-scoped via /settings.
 *
 * Stored in the shared settings blob under `candidate_cv_template` (was browser
 * localStorage — that made it per-device, not per-tenant). Reads through
 * useAllSettings (live, cached) and writes through saveSettingsKeys, so a change
 * in the CV template editor reflects everywhere the same session.
 */
import { useAllSettings, getJsonSetting, saveSettingsKeys } from './settings/useAllSettings'

// Where a section renders on the generated CV: the tinted sidebar column, the
// main (white) column, or — for `summary` only — inline in the page header.
export type CvSectionPlacement = 'sidebar' | 'main' | 'header'

// One toggleable section of the generated CV. `label` is a LEGACY display
// fallback only (a tenant may already have a saved blob carrying the old
// hardcoded English label) — the live label always comes from the
// `candidates:cv.<id>` i18n key, never this stored string (§5 i18n fix).
export interface CvSection { id: string; label: string; enabled: boolean; placement: CvSectionPlacement }

// Persisted CV branding + section configuration.
export interface CvSettings {
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  companyName: string
  sections: CvSection[]
}

export const CV_DEFAULT_SECTIONS: CvSection[] = [
  { id: 'contact',      label: 'Contact details', enabled: true,  placement: 'sidebar' },
  { id: 'summary',      label: 'About me',        enabled: true,  placement: 'header'  },
  { id: 'experience',   label: 'Work experience', enabled: true,  placement: 'main'    },
  { id: 'education',    label: 'Education',       enabled: true,  placement: 'main'    },
  { id: 'languages',    label: 'Languages',       enabled: true,  placement: 'sidebar' },
  { id: 'skills',       label: 'Skills',          enabled: true,  placement: 'sidebar' },
  { id: 'certificates', label: 'Certificates',    enabled: true,  placement: 'sidebar' },
  { id: 'preferences',  label: 'Preferences',     enabled: false, placement: 'main'    },
]

// Sections whose region is structural, not a tenant choice: `summary` renders
// inline in the page header (it has no sidebar/main column of its own), and
// `experience`/`education` are variable-length, description-heavy lists that
// do not fit the fixed-width sidebar column — a long entry list would either
// overflow it unreadably or, worse, break the coloured sidebar background's
// page-break handling once react-pdf has to wrap it onto a second page. Any
// stored/legacy value for these ids is ignored (defensive — a hand-edited or
// malformed blob can never move them), and the settings screen never offers
// the sidebar/main picker for them either.
export const CV_FIXED_PLACEMENT: Partial<Record<string, CvSectionPlacement>> = {
  summary: 'header', experience: 'main', education: 'main',
}

// Sections a tenant may freely move between the sidebar and the main column.
export const CV_MOVABLE_SECTION_IDS: string[] = CV_DEFAULT_SECTIONS
  .map(s => s.id)
  .filter(id => !CV_FIXED_PLACEMENT[id])

// Today's default region per section id — used to backfill a section entry
// saved before per-section placement existed (migration safety, see below).
const DEFAULT_PLACEMENT_BY_ID: Record<string, CvSectionPlacement> = Object.fromEntries(
  CV_DEFAULT_SECTIONS.map(s => [s.id, s.placement]),
)

/**
 * Resolves the region a section actually renders in. A structurally-fixed id
 * always wins (defensive — see CV_FIXED_PLACEMENT); otherwise an explicit,
 * valid stored value is honoured; a MISSING value (a legacy blob saved before
 * placement existed) falls back to today's default layout, so an existing CV
 * never silently changes just because this feature shipped.
 */
export function resolveCvSectionPlacement(sec: { id: string; placement?: string }): CvSectionPlacement {
  const fixed = CV_FIXED_PLACEMENT[sec.id]
  if (fixed) return fixed
  if (sec.placement === 'sidebar' || sec.placement === 'main') return sec.placement
  return DEFAULT_PLACEMENT_BY_ID[sec.id] ?? 'main'
}

/**
 * Normalizes a persisted section list so every downstream reader (settings
 * screen list, live preview, generated PDF) works from one already-resolved
 * `placement` instead of re-deriving it independently.
 */
export function normalizeCvSections(sections: Array<Partial<CvSection> & { id: string }>): CvSection[] {
  return sections.map(s => ({
    id: s.id,
    label: s.label ?? '',
    enabled: s.enabled !== false,
    placement: resolveCvSectionPlacement(s),
  }))
}

/* eslint-disable no-restricted-syntax -- seed DATA: default CV brand colours until a tenant customises, not UI styling */
const DEFAULTS: CvSettings = {
  primaryColor:   '#19A5CA',
  secondaryColor: '#1B60A9',
  logoUrl:        null,
  companyName:    '',
  sections:       CV_DEFAULT_SECTIONS,
}
/* eslint-enable no-restricted-syntax */

// Settings-blob key (tenant-scoped, JSON-encoded).
const SETTINGS_KEY = 'candidate_cv_template'

export function useCvSettings() {
  const values = useAllSettings()
  // Merge stored value over defaults so a partial/absent blob still renders fully.
  const stored = getJsonSetting<Partial<CvSettings>>(values, SETTINGS_KEY, {})
  // Normalize on every read so a legacy blob (saved before per-section placement
  // existed) keeps rendering in today's layout, never a value nobody chose.
  const sections = normalizeCvSections(stored.sections ?? CV_DEFAULT_SECTIONS)
  const settings: CvSettings = { ...DEFAULTS, ...stored, sections }

  // Persist a partial update to the tenant settings blob (optimistic via the cache).
  function save(patch: Partial<CvSettings>) {
    saveSettingsKeys({ [SETTINGS_KEY]: { ...settings, ...patch } }).catch(() => {})
  }

  // Restore defaults tenant-wide.
  function reset() {
    saveSettingsKeys({ [SETTINGS_KEY]: { ...DEFAULTS, sections: [...CV_DEFAULT_SECTIONS] } }).catch(() => {})
  }

  return { settings, save, reset }
}
