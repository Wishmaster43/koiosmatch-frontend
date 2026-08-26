/**
 * NumberSettingField — the ONE shared numeric tenant-setting field: title, hint,
 * an id-tied number input, min/max clamping, commit-on-blur through the generic
 * `/settings` key/value store, optimistic save with revert + toast on failure.
 *
 * STALE-INIT-1 (audit HIGH): the nine hand-rolled copies this replaces all did
 * `const saved = getNumberSetting(settings, KEY, DEFAULT); const [value, setValue]
 * = useState(saved)` — on a cold cache the settings blob is still {} on first
 * render, so `useState` froze the DEFAULT forever (later re-renders recompute
 * `saved` but never touch the already-initialised `value` state), showing the
 * default instead of the stored value and letting a blur before GET /settings
 * resolves silently overwrite the tenant's real stored value. The fix (mirrors
 * DocumentTypesSettings.jsx's ExpiringAlertDaysField / REQFIELDS-TOGGLE-RACE-1):
 * a nullable draft that falls back to the live `saved` on every render until the
 * user actually edits, plus a `useSettingsLoaded()` gate so a commit before the
 * blob has resolved is a no-op instead of a silent overwrite.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useAllSettings, useSettingsLoaded, saveSettingsKeys, invalidateAllSettingsCache, getNumberSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { SectionTitle, Caption } from '@/components/ui/typography'

export interface NumberSettingFieldProps {
  id: string
  settingsKey: string
  title: string
  hint: string
  label: string
  saveFailedMessage: string
  defaultValue: number
  min: number
  max: number
  // The house divider (marginBottom/paddingBottom/borderBottom) between stacked
  // fields — off for a field that is already the last one in its list.
  bordered?: boolean
  // Layout-only overrides from the call site (e.g. flexShrink in a flex column).
  style?: CSSProperties
}

export default function NumberSettingField({
  id, settingsKey, title, hint, label, saveFailedMessage, defaultValue, min, max, bordered = true, style,
}: NumberSettingFieldProps) {
  const settings = useAllSettings()
  const loaded = useSettingsLoaded()
  const saved = getNumberSetting(settings, settingsKey, defaultValue)
  // Nullable draft: `null` means "no local edit yet", so the input always shows
  // the live `saved` (which itself updates once the real blob loads) until the
  // user types — see STALE-INIT-1 above.
  const [draft, setDraft] = useState<number | null>(null)
  const value = draft ?? saved

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw: number) => {
    if (!loaded) return
    const clamped = Math.min(max, Math.max(min, Number(raw) || defaultValue))
    if (clamped === saved) { setDraft(clamped); return }
    setDraft(clamped)
    try {
      await saveSettingsKeys({ [settingsKey]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setDraft(null)
      notifyError(saveFailedMessage)
    }
  }

  const wrapperStyle: CSSProperties = {
    ...(bordered ? { marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' } : {}),
    ...style,
  }

  return (
    <div style={wrapperStyle}>
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{title}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{hint}</div>
      {/* Caption atom (11/400 muted) — the house identity for a field label (§4). */}
      <Caption as="label" htmlFor={id} style={{ display: 'block', marginBottom: 4 }}>
        {label}
      </Caption>
      <input id={id} type="number" min={min} max={max}
        value={value} disabled={!loaded}
        onChange={e => setDraft(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}
