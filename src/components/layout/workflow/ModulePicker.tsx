/**
 * ModulePicker — the modal that lists every workflow module (filtered by which
 * add-on apps the tenant has), grouped by category with search, and inserts the
 * picked module into the flow. Extracted from WorkflowCanvasEditor.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MODULE_META, MODULE_APP_MAP, MODULE_REQUIRED_MODULE } from '@/modules/index'
import { useApps } from '@/context/AppsContext'
import { useAuth } from '@/context/AuthContext'
import { categorySlug } from './moduleI18n'

// One [type, meta] pair from the module registry (used by the picker rows).
type ModuleMetaEntry = [string, (typeof MODULE_META)[string]]

const CATEGORY_ORDER = ['Alle', 'Triggers', 'Kandidaten', 'Sollicitaties', 'Vacatures', 'Matches', 'Kansen', 'Taken', 'Klanten', 'Planning', 'Communicatie', 'AI', 'ShiftManager', 'HelloFlex', 'Intus', 'Flow beheer', 'Tekst & Parsing']

export default function ModulePicker({ insertAfterEdgeId, onSelect, onClose }: {
  insertAfterEdgeId: string | null
  onSelect: (type: string, edgeId: string | null) => void
  onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  const [search, setSearch] = useState('')
  const [tab,    setTab]    = useState('Alle')
  const { isAppEnabled } = useApps() ?? {}
  const { hasModule } = (useAuth() as unknown as { hasModule?: (m: string) => boolean }) ?? {}

  // Translated module label + category (registry value = nl source / defaultValue).
  const modLabel = (type: string, label: string) => t('modules.' + type, { defaultValue: label })
  const catLabel = (cat: string) => t('categories.' + categorySlug(cat), { defaultValue: cat })

  // Hide a module when its connector-app is disabled OR its billing module is off.
  // Two axes: MODULE_APP_MAP → AppsContext connectors; MODULE_REQUIRED_MODULE → package add-ons.
  const isModuleEnabled = (type: string) => {
    const reqModule = MODULE_REQUIRED_MODULE[type]
    if (reqModule && !(hasModule?.(reqModule) ?? true)) return false
    const req = MODULE_APP_MAP[type]
    if (!req) return true
    const apps = Array.isArray(req) ? req : [req]
    return apps.some(a => isAppEnabled?.(a))
  }

  const allEntries = Object.entries(MODULE_META).filter(([type]) => isModuleEnabled(type))

  const visible = allEntries.filter(([type, m]) => {
    const matchSearch = !search || modLabel(type, m.label).toLowerCase().includes(search.toLowerCase())
    const matchTab    = tab === 'Alle' || m.category === tab
    return matchSearch && matchTab
  })

  // Count per category
  const counts: Record<string, number> = {}
  allEntries.forEach(([, m]) => {
    const c = m.category ?? 'Overig'
    counts[c] = (counts[c] ?? 0) + 1
  })

  const renderRow = ([type, meta]: ModuleMetaEntry) => {
    const Icon = meta.Icon as unknown as LucideIcon
    return (
      <button key={type} type="button"
        onClick={() => { onSelect(type, insertAfterEdgeId); onClose() }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={meta.color} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{modLabel(type, meta.label)}</div>
        </div>
      </button>
    )
  }

  // In "Alle" tab (or search), render with category dividers
  const renderGrouped = () => {
    const groups: Record<string, ModuleMetaEntry[]> = {}
    visible.forEach(entry => {
      const cat = entry[1].category ?? 'Overig'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(entry)
    })
    const orderedCats = CATEGORY_ORDER.filter(c => c !== 'Alle' && groups[c])
    const remaining = Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
    return [...orderedCats, ...remaining].map((cat, i) => (
      <div key={cat}>
        {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
        <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{catLabel(cat)}</div>
        {groups[cat].map(renderRow)}
      </div>
    ))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      <div style={{ width: 880, maxWidth: '94vw', maxHeight: '82vh', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header + zoeken */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('picker.title')}</span>
            <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('picker.search')}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--hover-bg)', boxSizing: 'border-box', marginBottom: 12 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 8px' }}>
          {CATEGORY_ORDER.filter(c => c === 'Alle' || counts[c]).map(cat => (
            <button key={cat} type="button" onClick={() => { setTab(cat); }}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: tab === cat ? 700 : 400,
                color: tab === cat ? 'var(--color-primary)' : 'var(--text-muted)',
                background: 'none', border: 'none', borderBottom: tab === cat ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              }}>
              {catLabel(cat)}
            </button>
          ))}
        </div>

        {/* Lijst */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {visible.length === 0 && (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('picker.empty')}</p>
          )}
          {visible.length > 0 && (tab === 'Alle' || search)
            ? renderGrouped()
            : visible.map(renderRow)
          }
        </div>
      </div>
    </div>
  )
}
