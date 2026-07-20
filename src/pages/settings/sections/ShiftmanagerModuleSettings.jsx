import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import SchemaSection from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'

/**
 * Shiftmanager module settings — ONE merged view (Danny 2026-07-20: "KPI en
 * weergave moeten 1 worden … voeg het eerst maar samen"): the KPI picks and the
 * display limits render stacked; pruning the obsolete fields is a separate,
 * explicit follow-up. The manual Sync tab is retired (SYNC-RETIRE-1 — the daily
 * sm:sync-all cron replaced it; the emergency trigger stays on the SM pages'
 * SmSyncButton). Reachability is registry-gated on the 'sm' module (→ Modules).
 */
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const { hasModule } = useAuth()

  // Defensive guard for direct deep links — the registry already hides the tab.
  if (!hasModule('sm')) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('shell.empty')}</p>
  }

  // Merged view: the KPI selection first, the display limits stacked below it.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SchemaSection schema={smKpisSchema} />
      <SchemaSection schema={displaySchema} />
    </div>
  )
}
