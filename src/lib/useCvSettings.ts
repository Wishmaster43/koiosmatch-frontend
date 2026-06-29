/**
 * useCvSettings — CV branding + section configuration, tenant-scoped via /settings.
 *
 * Stored in the shared settings blob under `candidate_cv_template` (was browser
 * localStorage — that made it per-device, not per-tenant). Reads through
 * useAllSettings (live, cached) and writes through saveSettingsKeys, so a change
 * in the CV template editor reflects everywhere the same session.
 */
import { useAllSettings, getJsonSetting, saveSettingsKeys } from './settings/useAllSettings'

// One toggleable section of the generated CV.
export interface CvSection { id: string; label: string; enabled: boolean }
// Persisted CV branding + section configuration.
export interface CvSettings {
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  companyName: string
  sections: CvSection[]
}

export const CV_DEFAULT_SECTIONS: CvSection[] = [
  { id: 'contact',      label: 'Contact details', enabled: true  },
  { id: 'summary',      label: 'About me',        enabled: true  },
  { id: 'experience',   label: 'Work experience', enabled: true  },
  { id: 'education',    label: 'Education',        enabled: true  },
  { id: 'languages',    label: 'Languages',       enabled: true  },
  { id: 'skills',       label: 'Skills',          enabled: true  },
  { id: 'certificates', label: 'Certificates',    enabled: true  },
  { id: 'preferences',  label: 'Preferences',     enabled: false },
]

const DEFAULTS: CvSettings = {
  primaryColor:   '#19A5CA',
  secondaryColor: '#1B60A9',
  logoUrl:        null,
  companyName:    '',
  sections:       CV_DEFAULT_SECTIONS,
}

// Settings-blob key (tenant-scoped, JSON-encoded).
const SETTINGS_KEY = 'candidate_cv_template'

export function useCvSettings() {
  const values = useAllSettings()
  // Merge stored value over defaults so a partial/absent blob still renders fully.
  const stored = getJsonSetting<Partial<CvSettings>>(values, SETTINGS_KEY, {})
  const settings: CvSettings = { ...DEFAULTS, ...stored, sections: stored.sections ?? CV_DEFAULT_SECTIONS }

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
