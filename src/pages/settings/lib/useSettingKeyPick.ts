import { useState } from 'react'
import { useAllSettings, useSettingsLoaded, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// One string setting key with an optimistic local pick (STALE-INIT-1: nullable draft so a
// cold cache never freezes the fallback); save() persists through saveSettingsKeys and reverts on failure.
export function useSettingKeyPick(key: string, fallback: string, failMessage: string): { value: string; saved: string; loaded: boolean; save: (next: string) => Promise<void> } {
  const settings = useAllSettings()
  const loaded = useSettingsLoaded()

  // Current saved value from the blob, or fallback if missing or not a string.
  const saved = typeof settings?.[key] === 'string' ? settings[key] : fallback

  // STALE-INIT-1: nullable draft — on a cold cache the settings blob is {} on
  // first render, so freezing `saved` into state (the old `useState(saved)`)
  // showed the seed fallback and never picked up the real stored value once the
  // GET resolved (a re-render recomputes `saved`, not the already-initialised
  // state). `null` means "no local pick yet", so the picker always shows the
  // live `saved` until the user actually chooses.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved

  // Optimistic save + revert on failure (house pattern); a no-op before the blob has
  // loaded, so a pick can't overwrite the real stored value with a stale comparison.
  const save = async (next: string): Promise<void> => {
    if (!loaded) return
    if (next === saved) { setDraft(next); return }
    setDraft(next)
    try {
      await saveSettingsKeys({ [key]: next })
      invalidateAllSettingsCache()
    } catch {
      setDraft(null)
      notifyError(failMessage)
    }
  }

  return { value, saved, loaded, save }
}
