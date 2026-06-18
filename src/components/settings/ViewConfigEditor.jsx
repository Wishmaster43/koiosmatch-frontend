/**
 * ViewConfigEditor — arrange a single module's view: toggle blocks on/off and
 * reorder them. Saves to `view.<module>` so the dashboard's <ModuleView> follows.
 *
 * Reorder is done with up/down controls (robust, no drag dependency).
 */
import { useState } from 'react'
import { GripVertical, ArrowUp, ArrowDown, Check, Save, RefreshCw } from 'lucide-react'
import { MODULES } from '../../lib/settings/moduleRegistry'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '../../lib/settings/useAllSettings'
import { viewConfigKey } from '../../lib/settings/useModuleView'

// Merge saved config with the registry so newly added blocks always appear.
function buildRows(moduleId, values) {
  const blocks = MODULES[moduleId]?.blocks ?? []
  const saved = getJsonSetting(values, viewConfigKey(moduleId), null)
  if (!Array.isArray(saved)) return blocks.map(b => ({ id: b.id, enabled: true }))
  const known = new Set(saved.map(s => s.id))
  const rows = saved
    .filter(s => blocks.some(b => b.id === s.id))
    .map(s => ({ id: s.id, enabled: s.enabled !== false }))
  blocks.forEach(b => { if (!known.has(b.id)) rows.push({ id: b.id, enabled: true }) })
  return rows
}

export default function ViewConfigEditor({ module }) {
  const values = useAllSettings()
  const mod = MODULES[module]
  const [rows, setRows] = useState(() => buildRows(module, values))
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

  const toggle = (id) => setRows(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  const move = (i, dir) => setRows(rs => {
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
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{mod.label} view</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            Choose which blocks appear on the {mod.label.toLowerCase()} dashboard and in what order.
          </p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
            fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> Saved</> : saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save</>}
        </button>
      </div>

      <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, i) => {
          const block = blockById[row.id]
          if (!block) return null
          const Icon = block.icon
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none', opacity: row.enabled ? 1 : 0.55 }}>
              <GripVertical size={15} style={{ color: '#D1D5DB', flexShrink: 0 }} />
              {Icon && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: block.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={block.color} />
                </div>
              )}
              <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 500 }}>{block.label}</span>

              <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: i === 0 ? 'default' : 'pointer',
                  color: i === 0 ? '#E5E7EB' : '#6B7280' }}>
                <ArrowUp size={13} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Move down"
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: i === rows.length - 1 ? 'default' : 'pointer',
                  color: i === rows.length - 1 ? '#E5E7EB' : '#6B7280' }}>
                <ArrowDown size={13} />
              </button>

              {/* enable toggle */}
              <button onClick={() => toggle(row.id)} title={row.enabled ? 'Hide' : 'Show'}
                style={{ width: 40, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: row.enabled ? 'var(--color-primary)' : '#E5E7EB', position: 'relative', transition: 'background 0.15s' }}>
                <span style={{ position: 'absolute', top: 2, left: row.enabled ? 18 : 2, width: 20, height: 20,
                  borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
