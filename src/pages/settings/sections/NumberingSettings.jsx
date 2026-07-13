/**
 * NumberingSettings — Settings → Nummering (NUMMER-1). One small grid: per entity
 * (Kandidaat/Klant/Vacature/Locatie/Afdeling/Match) a prefix, digit padding and
 * start value, backed by the generic settings store (`numbering.<entity>.*`).
 * Mirrors the house pattern (CandidateConversionSettings): useAllSettings +
 * saveSettingsKeys, optimistic per-field save with revert + toast on failure.
 * Each field commits on blur (not per keystroke) so typing never spams the API.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// The six entities the numbering system covers — key must match the backend
// settings namespace `numbering.<entity>.{prefix,pad,start}` (C-contract NUMMER-1).
// defaultPrefix/defaultPad only seed the field's placeholder value until the tenant
// saves its own — they are never written implicitly.
const ENTITIES = [
  { key: 'candidate',           defaultPrefix: 'K', defaultPad: 5 },
  { key: 'customer',            defaultPrefix: 'D', defaultPad: 5 },
  { key: 'vacancy',             defaultPrefix: 'V', defaultPad: 5 },
  { key: 'customer_location',   defaultPrefix: 'L', defaultPad: 3 },
  { key: 'customer_department', defaultPrefix: 'A', defaultPad: 3 },
  { key: 'match',               defaultPrefix: 'M', defaultPad: 5 },
]

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
  const savedPrefix = typeof settings?.[keys.prefix] === 'string' ? settings[keys.prefix] : entity.defaultPrefix
  const savedPad    = settings?.[keys.pad]   != null ? Number(settings[keys.pad])   : entity.defaultPad
  const savedStart  = settings?.[keys.start] != null ? Number(settings[keys.start]) : 1

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
        {t(`numbering.entities.${entity.key}`)}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input value={prefix} maxLength={8} aria-label={t('numbering.prefix')}
          onChange={e => setPrefix(e.target.value)}
          onBlur={e => commit(keys.prefix, e.target.value.trim() || entity.defaultPrefix, savedPrefix, setPrefix)}
          style={{ ...cellInput, width: 70 }} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input type="number" min={1} max={8} value={pad} aria-label={t('numbering.pad')}
          onChange={e => setPad(Number(e.target.value))}
          onBlur={e => commit(keys.pad, Math.min(8, Math.max(1, Number(e.target.value) || entity.defaultPad)), savedPad, setPad)}
          style={{ ...cellInput, width: 64, textAlign: 'right' }} />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <input type="number" min={1} value={start} aria-label={t('numbering.start')}
          onChange={e => setStart(Number(e.target.value))}
          onBlur={e => commit(keys.start, Math.max(1, Number(e.target.value) || 1), savedStart, setStart)}
          style={{ ...cellInput, width: 80, textAlign: 'right' }} />
      </td>
    </tr>
  )
}

export default function NumberingSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('numbering.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('numbering.subtitle')}</div>
      {/* Hint: changes only affect NEW numbers — existing reference numbers never change. */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 14 }}>{t('numbering.hint')}</div>
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
            {ENTITIES.map(entity => <EntityRow key={entity.key} entity={entity} settings={settings} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
