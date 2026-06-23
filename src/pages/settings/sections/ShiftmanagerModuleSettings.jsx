import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SchemaSection from '../components/SchemaSection'
import SyncSettings from './SyncSettings'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'

// Sub-tabs inside the Shiftmanager module. KPIs here drive the *Shiftmanager*
// dashboard (distinct from general/kpis, which drives the main dashboard).
const SUBTABS = [
  { id: 'kpis',    labelKey: 'nav.kpis' },
  { id: 'display', labelKey: 'nav.display' },
  { id: 'sync',    labelKey: 'nav.sync' },
]

/** Shiftmanager module settings — sub-tabbed: KPIs / Display limits / Sync. */
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const [sub, setSub] = useState('kpis')

  return (
    <div>
      {/* Sub-tab bar (one level below the Modules tab). */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {SUBTABS.map(s => {
          const active = s.id === sub
          return (
            <button key={s.id} role="tab" aria-selected={active} onClick={() => setSub(s.id)}
              style={{ padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}>
              {t(s.labelKey)}
            </button>
          )
        })}
      </div>

      {sub === 'kpis' && <SchemaSection schema={smKpisSchema} />}
      {sub === 'display' && <SchemaSection schema={displaySchema} />}
      {sub === 'sync' && <SyncSettings />}
    </div>
  )
}
