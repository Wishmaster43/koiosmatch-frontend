/**
 * useFunctions — tenant-configurable job-function list (e.g. "Verzorgende IG").
 *
 * Fed by the API (GET /functions) with a healthcare default as fallback while the
 * API is empty/unavailable. Managed in Settings → Functies. Items are plain name
 * strings (the candidate/vacancy stores the name). `allowFreeEntry` mirrors the
 * tenant setting: when true the function field is a creatable combobox, when false
 * it is a strict dropdown. Defaults to true until the API says otherwise.
 */
import { useState, useEffect } from 'react'
import api from './api'

export const DEFAULT_FUNCTIONS = [
  'Helpende', 'Helpende Plus', 'Verzorgende', 'Verzorgende IG', "EVV'er",
  'Verpleegkundige N4', 'Verpleegkundige N5', 'Wijkverpleegkundige', 'Doktersassistent',
]

// Normalise API rows (string | {name|label|value}) to plain name strings.
const names = (res) => (res?.data?.data ?? res?.data ?? [])
  .map(x => (typeof x === 'string' ? x : (x.name ?? x.label ?? x.value)))
  .filter(Boolean)

export function useFunctions() {
  const [functions, setFunctions] = useState(DEFAULT_FUNCTIONS)
  const [allowFreeEntry, setAllowFreeEntry] = useState(true)

  // Override the default with the configured list + setting once the API responds.
  useEffect(() => {
    api.get('/functions').then(r => {
      const d = names(r); if (d.length) setFunctions(d)
      const free = r?.data?.allow_free_entry
      if (typeof free === 'boolean') setAllowFreeEntry(free)
    }).catch(() => {})
  }, [])

  return { functions, allowFreeEntry }
}
