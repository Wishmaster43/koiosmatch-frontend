/**
 * SmSyncButton (SYNC-1) — the manual "Sync" action next to "Laatste sync" on the SM
 * dashboard charts. One active Shiftmanager connection syncs immediately; several open
 * a small SelectMenu picker first (never guesses which account — same rule as the
 * workflow sm_* modules' own connection_id field). Gated on superadmin role (route is
 * backend-superadmin-only), disabled (not hidden) with a tooltip when missing — the
 * backend re-checks the role regardless (§7).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Check, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import SelectMenu from '@/components/ui/SelectMenu'
import Button from '@/components/ui/Button'
import { useSmConnections } from './useSmConnections'
import { useSmSync } from './useSmSync'

// The manual Shiftmanager sync action (see file docblock above): syncs immediately
// with one connection, or opens a picker first with several — never a silent guess.
export default function SmSyncButton() {
  const { t } = useTranslation('shiftmanager')
  const auth = useAuth()
  const canSync = auth?.isSuperAdmin?.() ?? false
  const { connections, loading: loadingConnections } = useSmConnections()
  const { syncing, result, sync } = useSmSync()
  // The picker only replaces the button once it's actually needed (2+ connections) —
  // a single connection never shows a dropdown, it just fires straight away.
  const [picking, setPicking] = useState(false)

  const noConnection = !loadingConnections && connections.length === 0
  const blocked = !canSync || syncing || noConnection || loadingConnections

  // Entry point: one connection syncs immediately, several open the picker instead.
  const handleClick = () => {
    if (blocked) return
    if (connections.length === 1) { sync(connections[0].value); return }
    setPicking(true)
  }

  const title = !canSync ? t('charts.sync.noPermission')
    : noConnection ? t('charts.sync.noConnection')
    : undefined

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {picking ? (
        <SelectMenu
          value={null}
          options={connections}
          onChange={(id) => { setPicking(false); sync(id) }}
          placeholder={t('charts.sync.choose')}
          menuWidth={220}
        />
      ) : (
        <Button type="button" variant="secondary" onClick={handleClick} disabled={blocked} title={title}
          style={{ gap: 5, padding: '0 10px' }}>
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          {syncing ? t('charts.sync.busy') : t('charts.sync.button')}
        </Button>
      )}
      {result && !syncing && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
          color: result.kind === 'queued' ? 'var(--color-info)'
            : result.kind === 'throttled' ? 'var(--color-warning)' : 'var(--color-danger)',
        }}>
          {result.kind === 'queued' ? <Check size={11} /> : result.kind === 'throttled' ? <Clock size={11} /> : <AlertTriangle size={11} />}
          {result.kind === 'queued' ? t('charts.sync.started')
            : result.kind === 'throttled' ? t('charts.sync.tooManyRequests', { secs: result.retryAfter })
            : (result.detail ?? t('charts.sync.failed'))}
        </span>
      )}
    </div>
  )
}
