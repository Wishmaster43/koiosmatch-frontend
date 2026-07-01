/**
 * ScopeEditor — the per-entity access grid (toggle + permission level), shared by
 * the create modal and the Access tab so both render identical rows. Pure and
 * controlled: it renders `value` (an { entity: level } map) and reports edits via
 * onChange — the parent decides when/how to persist. Off = entity absent = no access.
 */
import { useTranslation } from 'react-i18next'
import { Toggle } from '@/pages/settings/components/SettingsKit'
import { SCOPE_ENTITIES, ACCESS_LEVELS } from './constants'

export default function ScopeEditor({ value = {}, onChange }) {
  const { t } = useTranslation('settings')

  // Toggling on defaults to read; toggling off removes the entity entirely.
  const toggle = (entity) => {
    const next = { ...value }
    if (next[entity]) delete next[entity]
    else next[entity] = 'read'
    onChange(next)
  }

  // Switch the permission level for an already-enabled entity.
  const setLevel = (entity, level) => onChange({ ...value, [entity]: level })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {SCOPE_ENTITIES.map((entity, i) => {
        const level = value[entity]
        const on = Boolean(level)
        return (
          <div key={entity} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <Toggle checked={on} onChange={() => toggle(entity)} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: on ? 500 : 400 }}>
              {t(`apiKeys.scopes.${entity}`)}
            </span>
            <select value={level ?? 'read'} onChange={(e) => setLevel(entity, e.target.value)} disabled={!on}
              aria-label={t(`apiKeys.scopes.${entity}`)}
              style={{ height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: on ? 'var(--text)' : 'var(--text-muted)', cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.5 }}>
              {ACCESS_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`apiKeys.level.${lvl}`)}</option>)}
            </select>
          </div>
        )
      })}
    </div>
  )
}
