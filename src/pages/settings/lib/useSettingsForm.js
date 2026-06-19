/**
 * useSettingsForm — removes the load/save/dirty boilerplate that every settings
 * section used to copy by hand (loadSettings on mount, a `value` state, a save()
 * that POSTs, and saved/saving flags).
 *
 * Pass a `defaults` map of { key: typedDefault }. Values coming back from the API
 * are strings, so we coerce each one to the type of its default (number/boolean/
 * string). The hook tracks dirtiness by comparing the live values to the last
 * persisted snapshot, so the scaffold's save button can disable itself until
 * there is actually something to save.
 *
 *   const form = useSettingsForm({ top_cities_n: 10, show_avatars: true })
 *   form.values.top_cities_n      // current value
 *   form.set('top_cities_n', 20)  // update one key
 *   form.dirty / loading / saving / saved
 *   form.save()                   // persists + resets the dirty baseline
 */
import { useEffect, useMemo, useState } from 'react'
import { loadSettings, saveSettings } from './settingsApi'

function coerce(raw, sample) {
  if (typeof sample === 'number')  return Number(raw)
  if (typeof sample === 'boolean') return raw === true || raw === 'true'
  return raw == null ? '' : String(raw)
}

export function useSettingsForm(defaults) {
  // Snapshot the defaults once (lazy init) so callers can pass an inline object
  // literal without retriggering the load effect on every render.
  const [base] = useState(() => defaults)
  const [values,  setValues]  = useState(base)
  const [initial, setInitial] = useState(base)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    let alive = true
    loadSettings()
      .then(stored => {
        if (!alive) return
        const next = { ...base }
        for (const key of Object.keys(base)) {
          if (stored[key] !== undefined) next[key] = coerce(stored[key], base[key])
        }
        setValues(next)
        setInitial(next)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [base])

  const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  )

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings(values)
      setInitial(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* surfaced by the API layer; keep the form editable */ }
    finally { setSaving(false) }
  }

  return { values, set, setValues, dirty, loading, saving, saved, save }
}
