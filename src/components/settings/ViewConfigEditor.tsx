/**
 * ViewConfigEditor — arrange a single module's view: toggle blocks on/off and
 * reorder them. Saves to `view.<module>` so the dashboard's <ModuleView> follows.
 *
 * Reorder is done with up/down controls (robust, no drag dependency).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, ArrowUp, ArrowDown, Check, Save, RefreshCw } from 'lucide-react'
import { MODULES } from '@/lib/settings/moduleRegistry'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { viewConfigKey } from '@/lib/settings/useModuleView'

interface Row { id: string; enabled: boolean }
interface SavedRow { id: string; enabled?: boolean }
type SettingsBlob = Record<string, unknown>

// Merge saved config with the registry so newly added blocks always appear.
function buildRows(moduleId: string, values: SettingsBlob): Row[] {
  const blocks = MODULES[moduleId]?.blocks ?? []
  const saved = getJsonSetting<SavedRow[] | null>(values, viewConfigKey(moduleId), null)
  if (!Array.isArray(saved)) return blocks.map(b => ({ id: b.id, enabled: true }))
  const known = new Set(saved.map(s => s.id))
  const rows = saved
    .filter(s => blocks.some(b => b.id === s.id))
    .map(s => ({ id: s.id, enabled: s.enabled !== false }))
  blocks.forEach(b => { if (!known.has(b.id)) rows.push({ id: b.id, enabled: true }) })
  return rows
}

export default function ViewConfigEditor({ module }: { module: string }) {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  const mod = MODULES[module]
  const [rows, setRows] = useState<Row[]>(() => buildRows(module, values))
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sync when the module changes or settings load in.
  const [prevKey, setPrevKey] = useState(module)
  const valuesKey = values[viewConfigKey(module)]
  const [prevValues, setPrevValues] = useState(valuesKey)
  if (module !== prevKey || valuesKey !== prevValues) {
    setPrevKey(module); setPrevValues(valuesKey)
    setRows(buildRows(module, values))
  }

  if (!mod) return null
  const blockById = Object.fromEntries(mod.blocks.map(b => [b.id, b]))

  const toggle = (id: string) => setRows(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  const move = (i: number, dir: number) => setRows(rs => {
    const j = i + dir
    if (j < 0 || j >= rs.length) return rs
    const next = [...rs];[next[i], next[j]] = [next[j], next[i]]; return next
  })

  const save = async () => {
    setSaving(true)
    try {
      await saveSettingsKeys({ [viewConfigKey(module)]: rows })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('viewConfig.title', { label: mod.label })}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('viewConfig.description', { label: mod.label.toLowerCase() })}
          </p>
        </div>
        <button onClick={save} disabled={saving} aria-label={t('common.save')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
            fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, i) => {
          const block = blockById[row.id]
          if (!block) return null
          const Icon = block.icon
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', opacity: row.enabled ? 1 : 0.55 }}>
              <GripVertical size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              {Icon && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: block.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={block.color} />
                </div>
              )}
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{block.label}</span>

              <button onClick={() => move(i, -1)} disabled={i === 0} title={t('viewConfig.moveUp')} aria-label={t('viewConfig.moveUp')}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: i === 0 ? 'default' : 'pointer',
                  color: i === 0 ? 'var(--border)' : 'var(--text-muted)' }}>
                <ArrowUp size={13} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} title={t('viewConfig.moveDown')} aria-label={t('viewConfig.moveDown')}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: i === rows.length - 1 ? 'default' : 'pointer',
                  color: i === rows.length - 1 ? 'var(--border)' : 'var(--text-muted)' }}>
                <ArrowDown size={13} />
              </button>

              {/* enable toggle */}
              <button onClick={() => toggle(row.id)} title={row.enabled ? t('viewConfig.hide') : t('viewConfig.show')} aria-label={row.enabled ? t('viewConfig.hide') : t('viewConfig.show')}
                style={{ width: 40, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: row.enabled ? 'var(--color-primary)' : 'var(--border)', position: 'relative', transition: 'background 0.15s' }}>
                <span style={{ position: 'absolute', top: 2, left: row.enabled ? 18 : 2, width: 20, height: 20,
                  borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.15s' }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
