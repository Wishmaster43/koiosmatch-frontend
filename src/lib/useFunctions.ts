/**
 * useFunctions — tenant-configurable job-function list (e.g. "Verzorgende IG").
 *
 * Fed by the API (GET /functions) with a healthcare default as fallback while the
 * API is empty/unavailable. Managed in Settings → Functies. Items are plain name
 * strings (the candidate/vacancy stores the name). `allowFreeEntry` = creatable
 * combobox (true) vs strict dropdown (false): the tenant toggle (setting
 * `functions_allow_free_entry`) wins, else the API flag, else **false** (strict default).
 */
import { useState, useEffect } from 'react'
import api from './api'
import { lookupNames } from './lookupUtils'
import { useAllSettings, getBoolSetting } from './settings/useAllSettings'

export const DEFAULT_FUNCTIONS = [
  'Helpende', 'Helpende Plus', 'Verzorgende', 'Verzorgende IG', "EVV'er",
  'Verpleegkundige N4', 'Verpleegkundige N5', 'Wijkverpleegkundige', 'Doktersassistent',
]

export function useFunctions() {
  const settings = useAllSettings()
  const [functions, setFunctions] = useState<string[]>(DEFAULT_FUNCTIONS)
  const [apiFreeEntry, setApiFreeEntry] = useState<boolean | null>(null)

  // Override the default with the configured list + API flag once it responds.
  useEffect(() => {
    api.get('/functions').then(r => {
      const d = lookupNames(r); if (d.length) setFunctions(d)
      const free = r?.data?.allow_free_entry
      if (typeof free === 'boolean') setApiFreeEntry(free)
    }).catch(() => {})
  }, [])

  // The Settings → Functies toggle is the source of truth; fall back to the API flag, then
  // false — strict by default (clean vocab for matching/AI; the backend default is OFF too).
  const allowFreeEntry = getBoolSetting(settings, 'functions_allow_free_entry', apiFreeEntry ?? false)

  return { functions, allowFreeEntry }
}
