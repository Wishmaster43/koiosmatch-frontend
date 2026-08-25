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
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useModuleCatalog } from './useModuleCatalog'
import Button from '@/components/ui/Button'

// One [type, meta] pair from the module registry (used by the picker rows).
type ModuleMetaEntry = [string, (typeof MODULE_META)[string]]

const CATEGORY_ORDER = ['Alle', 'Triggers', 'Kandidaten', 'Sollicitaties', 'Vacatures', 'Matches', 'Kansen', 'Taken', 'Klanten', 'Planning', 'Communicatie', 'AI', 'Shiftmanager', 'HelloFlex', 'Intus', 'Facebook', 'Flow beheer', 'Tekst & Parsing']

// PICKER-INTERSECT: trigger-role modules (registry category 'Triggers' — webhook,
// applicant_event, gateway_mail_hook) start a workflow run rather than execute as an
// engine action step, so the backend engine's action map never lists them by design —
// they stay exempt from the executability gate below regardless of the catalog.
const TRIGGER_CATEGORY = 'Triggers'

export default function ModulePicker({ insertAfterEdgeId, onSelect, onClose }: {
  insertAfterEdgeId: string | null
  onSelect: (type: string, edgeId: string | null) => void
  onClose: () => void
}) {
  // Esc closes + Tab stays inside (useFocusTrap owns both, §6).
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('workflows')
  const [search, setSearch] = useState('')
  const [tab,    setTab]    = useState('Alle')
  const { isAppEnabled } = useApps() ?? {}
  const { hasModule } = (useAuth() as unknown as { hasModule?: (m: string) => boolean }) ?? {}
  // PICKER-INTERSECT: GET /workflows/modules, keyed by type — the backend engine's
  // real executable set. Fails soft to {} on error/while loading (useModuleCatalog).
  const { catalog } = useModuleCatalog()

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

  // PICKER-INTERSECT: only offer a module the engine can actually run. An EMPTY
  // catalog carries no executability info at all (still loading, or the fetch
  // failed soft) — degrade honestly by offering everything the app/module gates
  // already allowed, never an empty picker; a NON-EMPTY catalog is real signal and
  // filters for real. Trigger-role modules never appear in that map by design.
  // Shape floor (Opus F4): the engine map carries ~40 types, so a response that
  // unwraps to a couple of stray keys is corruption, not signal — treating it as
  // known would strip ~67 of 68 modules and mark every saved node.
  const catalogKnown = Object.keys(catalog).length >= 5
  const isExecutable = (type: string, category?: string) => {
    if (category === TRIGGER_CATEGORY) return true
    if (!catalogKnown) return true
    return type in catalog
  }

  // Hidden modules (registry `hidden: true` — currently only the applicant_message
  // FE orphan) never appear as a new-node offer; existing saved nodes still edit
  // fine since MODULE_SCHEMAS/ConfigPanel are unaffected by this list.
  const allEntries = Object.entries(MODULE_META).filter(([type, m]) => !m.hidden && isModuleEnabled(type) && isExecutable(type, m.category))

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

  // Compact tile (grid cell): icon + label. A row-per-module list didn't scale
  // once the catalog grew (endless scrolling, Danny 2026-07-06).
  const renderTile = ([type, meta]: ModuleMetaEntry) => {
    const Icon = meta.Icon as unknown as LucideIcon
    return (
      <button key={type} type="button"
        onClick={() => { onSelect(type, insertAfterEdgeId); onClose() }}
        title={modLabel(type, meta.label)}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- module-KEUZETILE (icooncirkel + 2-regel-label, grid): een kaartface die Button-varianten niet modelleren; geen actieknop
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 6px', background: 'none', border: '1px solid transparent', borderRadius: 10, cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={meta.color} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {modLabel(type, meta.label)}
        </div>
      </button>
    )
  }

  // Responsive tile grid shared by every view.
  const renderGrid = (entries: ModuleMetaEntry[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4, padding: '4px 12px' }}>
      {entries.map(renderTile)}
    </div>
  )

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
        {renderGrid(groups[cat])}
      </div>
    ))
  }

  return (
    // HUISSTIJL-1: modal dialog — z-overlay ladder tier, shadow-modal role.
    <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      {/* Esc + focus trap via the §6-canonical hook (blok 1 punt 3.3). */}
      <div ref={trapRef} role="dialog" aria-modal="true" style={{ width: 1100, maxWidth: '94vw', maxHeight: '82vh', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header + zoeken */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('picker.title')}</span>
            <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}>
              <X size={16} />
            </Button>
          </div>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('picker.search')}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--hover-bg)', boxSizing: 'border-box', marginBottom: 12 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 8px' }}>
          {CATEGORY_ORDER.filter(c => c === 'Alle' || counts[c]).map(cat => (
            <button key={cat} type="button" onClick={() => { setTab(cat); }}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- rustende categorie-TAB (plaatsmarkering, PRIMAIR-VLAK-1): underline-actief, geen actieknop
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: tab === cat ? 700 : 400,
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: tab === cat ? 'var(--color-primary-text)' : 'var(--text-muted)',
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
            : renderGrid(visible)
          }
        </div>
      </div>
    </div>
  )
}
