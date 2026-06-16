import { useState } from 'react'

export const CV_DEFAULT_SECTIONS = [
  { id: 'contact',      label: 'Contactgegevens', enabled: true  },
  { id: 'samenvatting', label: 'Over mij',        enabled: true  },
  { id: 'ervaring',     label: 'Werkervaring',    enabled: true  },
  { id: 'opleiding',    label: 'Opleiding',       enabled: true  },
  { id: 'talen',        label: 'Talen',           enabled: true  },
  { id: 'vaardigheden', label: 'Vaardigheden',    enabled: true  },
  { id: 'certificaten', label: 'Certificaten',    enabled: true  },
  { id: 'voorkeuren',   label: 'Voorkeuren',      enabled: false },
]

const DEFAULTS = {
  primaryColor: '#6366F1',
  logoUrl:      null,
  companyName:  '',
  sections:     CV_DEFAULT_SECTIONS,
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
