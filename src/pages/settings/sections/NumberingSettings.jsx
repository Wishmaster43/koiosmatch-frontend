/**
 * NumberingSettings — Settings → Nummering (NUMMER-1). One small grid: per entity
 * a prefix, digit padding and start value, backed by the generic settings store
 * (`numbering.<entity>.*`). Mirrors the house pattern (CandidateConversionSettings):
 * useAllSettings + saveSettingsKeys, optimistic per-field save with revert + toast
 * on failure. Each field commits on blur (not per keystroke) so typing never spams
 * the API.
 *
 * The entity list itself now comes from GET /numbering-entities (NUMBERING-LOOKUP-1,
 * useNumberingEntities) instead of a hardcoded array — the backend's
 * config/numbering.php defines TWELVE entities, but this screen used to render
 * only the first six it happened to know about (CMBE 04-08 finding). A new entity
 * added to the backend config now appears here with zero frontend changes.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { useNumberingEntities } from '@/lib/useNumberingEntities'
import { notifyError } from '@/lib/notify'
import { PageTitle, Caption } from '@/components/ui/typography'

const cellInput = {
  height: 32, padding: '0 8px', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box',
  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', fontFamily: 'inherit',
}
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }

// One entity's prefix/pad/start row — reads its three flat settings keys and
// commits each independently on blur (optimistic + revert-on-failure).
function EntityRow({ entity, settings }) {
  const { t } = useTranslation('settings')
  const keys = {
    prefix: `numbering.${entity.key}.prefix`,
    pad:    `numbering.${entity.key}.pad`,
    start:  `numbering.${entity.key}.start`,
  }
  const savedPrefix = typeof settings?.[keys.prefix] === 'string' ? settings[keys.prefix] : entity.prefix
  const savedPad    = settings?.[keys.pad]   != null ? Number(settings[keys.pad])   : entity.pad
  const savedStart  = settings?.[keys.start] != null ? Number(settings[keys.start]) : entity.start

  const [prefix, setPrefix] = useState(savedPrefix)
  const [pad,    setPad]    = useState(savedPad)
  const [start,  setStart]  = useState(savedStart)

  // Persist one field — optimistic, revert + toast on failure (house pattern).
  const commit = async (key, value, prevValue, setter) => {
    if (value === prevValue) return
    setter(value)
    try {
      await saveSettingsKeys({ [key]: value })
      invalidateAllSettingsCache()
    } catch {
      setter(prevValue)
      notifyError(t('numbering.saveFailed'))
    }
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
        {/* Translated key wins once it ships; the backend's own Dutch label is an
            honest graceful fallback for an entity whose key has no translation yet
            (mirrors ModulePicker's t(key, { defaultValue }) convention). */}
        {t(`numbering.entities.${entity.key}`, { defaultValue: entity.label })}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input value={prefix} maxLength={8} aria-label={t('numbering.prefix')}
          onChange={e => setPrefix(e.target.value)}
          onBlur={e => commit(keys.prefix, e.target.value.trim() || entity.prefix, savedPrefix, setPrefix)}
          style={{ ...cellInput, width: 70 }} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input type="number" min={1} max={8} value={pad} aria-label={t('numbering.pad')}
          onChange={e => setPad(Number(e.target.value))}
          onBlur={e => commit(keys.pad, Math.min(8, Math.max(1, Number(e.target.value) || entity.pad)), savedPad, setPad)}
          style={{ ...cellInput, width: 64, textAlign: 'right' }} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input type="number" min={1} value={start} aria-label={t('numbering.start')}
          onChange={e => setStart(Number(e.target.value))}
          onBlur={e => commit(keys.start, Math.max(1, Number(e.target.value) || entity.start), savedStart, setStart)}
          style={{ ...cellInput, width: 80, textAlign: 'right' }} />
      </td>
    </tr>
  )
}

export default function NumberingSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  // The entity list itself (candidate/customer/…/location) — fetched from the
  // backend so a config-only addition needs no frontend change (see file header).
  const { entities, loading: entitiesLoading } = useNumberingEntities()

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle as="div" style={{ marginBottom: 4 }}>{t('numbering.title')}</PageTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('numbering.subtitle')}</div>
      {/* Hint: changes only affect NEW numbers — existing reference numbers never change. */}
      <Caption as="div" style={{ fontStyle: 'italic', marginBottom: 14 }}>{t('numbering.hint')}</Caption>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
              <th style={th}>{t('numbering.entity')}</th>
              <th style={th}>{t('numbering.prefix')}</th>
              <th style={th}>{t('numbering.pad')}</th>
              <th style={th}>{t('numbering.start')}</th>
            </tr>
          </thead>
          <tbody>
            {entities.map(entity => <EntityRow key={entity.key} entity={entity} settings={settings} />)}
          </tbody>
        </table>
      </div>
      {/* Honest loading note — the table above already shows the seeded fallback
          rows immediately, this only flags that the live list is still resolving.
          No separate empty-state: useNumberingEntities never resolves to an empty
          list (a genuinely empty response keeps the six-entity seed, see its own
          file header) — a real backend outage still lands on the seed above, never
          a blank table. */}
      {entitiesLoading && (
        <Caption as="div" style={{ marginTop: 8 }}>{t('common.loading')}</Caption>
      )}
    </div>
  )
}
