/**
 * useSettingsDirty — typed accessor for SettingsDirtyContext. The underlying
 * context lives in a plain .js file (createContext(null), untyped like every
 * other consumer, see settingsDirty.js) — this one typed helper removes the
 * double cast a TS caller would otherwise need at every call site.
 */
import { useContext } from 'react'
import { SettingsDirtyContext } from './settingsDirty'

// The shape the shell's provider actually passes down (SettingsPage.jsx).
export interface SettingsDirtyApi {
  report: (dirty: boolean) => void
}

// Narrows the untyped context value once, for every TS consumer.
export function useSettingsDirty(): SettingsDirtyApi | null {
  return useContext(SettingsDirtyContext) as SettingsDirtyApi | null
}
