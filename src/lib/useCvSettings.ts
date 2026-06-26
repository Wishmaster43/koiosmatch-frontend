import { useState } from 'react'

// One toggleable section of the generated CV.
export interface CvSection { id: string; label: string; enabled: boolean }
// Persisted CV branding + section configuration (localStorage-backed for now).
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

const STORAGE_KEY = 'koios_cv_settings'

export function useCvSettings() {
  const [settings, setSettings] = useState<CvSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CvSettings>
        return { ...DEFAULTS, ...parsed, sections: parsed.sections ?? CV_DEFAULT_SECTIONS }
      }
    } catch { /* ignore corrupt local settings */ }
    return { ...DEFAULTS, sections: [...CV_DEFAULT_SECTIONS] }
  })

  function save(patch: Partial<CvSettings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage full/blocked */ }
      return next
    })
  }

  function reset() {
    const fresh: CvSettings = { ...DEFAULTS, sections: [...CV_DEFAULT_SECTIONS] }
    setSettings(fresh)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage blocked */ }
  }

  return { settings, save, reset }
}
