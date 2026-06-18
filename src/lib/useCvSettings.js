import { useState } from 'react'

export const CV_DEFAULT_SECTIONS = [
  { id: 'contact',      label: 'Contact details', enabled: true  },
  { id: 'summary',      label: 'About me',        enabled: true  },
  { id: 'experience',   label: 'Work experience', enabled: true  },
  { id: 'education',    label: 'Education',        enabled: true  },
  { id: 'languages',    label: 'Languages',       enabled: true  },
  { id: 'skills',       label: 'Skills',          enabled: true  },
  { id: 'certificates', label: 'Certificates',    enabled: true  },
  { id: 'preferences',  label: 'Preferences',     enabled: false },
]

const DEFAULTS = {
  primaryColor:   '#19A5CA',
  secondaryColor: '#1B60A9',
  logoUrl:        null,
  companyName:    '',
  sections:       CV_DEFAULT_SECTIONS,
}

const STORAGE_KEY = 'koios_cv_settings'

export function useCvSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return { ...DEFAULTS, ...parsed, sections: parsed.sections ?? CV_DEFAULT_SECTIONS }
      }
    } catch {}
    return { ...DEFAULTS, sections: [...CV_DEFAULT_SECTIONS] }
  })

  function save(patch) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function reset() {
    const fresh = { ...DEFAULTS, sections: [...CV_DEFAULT_SECTIONS] }
    setSettings(fresh)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return { settings, save, reset }
}
