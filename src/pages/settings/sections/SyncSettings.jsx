/**
 * SyncSettings — manual data pull per endpoint, with per-item cooldown, a live
 * timer while running and a session log. Labels/messages come from settings:sync.*.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Clock, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const COOLDOWN_SECS = 60

// key drives i18n (sync.items.<key>.label/desc); endpoint null = not available yet.
const SYNC_ENDPOINTS = [
  { key: 'candidates',  endpoint: '/sm_candidates/sync' },
  { key: 'customers',   endpoint: '/sm_customers/sync' },
  { key: 'locations',   endpoint: '/sm_customers/sync', viaCustomers: true },
  { key: 'departments', endpoint: '/sm_customers/sync', viaCustomers: true },
  { key: 'contacts',    endpoint: '/sm_customers/sync', viaCustomers: true },
  { key: 'orders',      endpoint: null, disabled: true },
  { key: 'shifts',      endpoint: null, disabled: true },
  { key: 'invites',     endpoint: null, disabled: true },
]

function useLiveTimer(running) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (running) {
      setElapsed(0)
      ref.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      clearInterval(ref.current)
    }
    return () => clearInterval(ref.current)
  }, [running])
  return elapsed
}

function SyncRow({ item, user, canSync, onLog }) {
  const { t } = useTranslation('settings')
  const [result,   setResult]   = useState(null)
  const [running,  setRunning]  = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const coolRef = useRef(null)
  const elapsed = useLiveTimer(running)

  const label = t(`sync.items.${item.key}.label`)
  const description = t(`sync.items.${item.key}.desc`)

  const startCooldown = (secs) => {
    setCooldown(secs)
    coolRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(coolRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const run = async () => {
    if (!item.endpoint || running || cooldown > 0) return
    setRunning(true)
    setResult(null)
    try {
      const res = await api.post(item.endpoint)
      // Full SM syncs are async now: 202 = job queued, NO result counts in the
      // response. Show "started", not "X synced". The lists update once the job
      // finishes (no status endpoint yet — the user refreshes later).
      const started = res.status === 202 || res.data?.status === 'queued'
      const entry = {
        ok: true,
        started,
        msg: res.data?.message ?? (started
          ? t('sync.started', { defaultValue: 'Synchronisatie gestart — dit kan enkele minuten duren. Ververs de lijsten later voor de bijgewerkte data.' })
          : t('sync.succeeded')),
        at: new Date().toLocaleTimeString('nl-NL'), user: user?.name ?? '—', label,
      }
      setResult(entry)
      onLog(entry)
      startCooldown(COOLDOWN_SECS)
    } catch (err) {
      const status     = err.response?.status
      const retryAfter = err.response?.data?.retry_after
      // 403 (geen sm-module), 404/422 (geen actieve SM-connectie) en overige
      // fouten tonen de server-message; 429 toont de rate-limit-melding.
      const msg = status === 429
        ? t('sync.tooManyRequests', { secs: retryAfter ?? 60 })
        : (err.response?.data?.message ?? t('sync.failed'))
      const entry = { ok: false, started: false, msg,
                      at: new Date().toLocaleTimeString('nl-NL'), user: user?.name ?? '—', label }
      setResult(entry)
      onLog(entry)
      if (retryAfter) startCooldown(retryAfter)
    }
    setRunning(false)
  }

  const blocked = running || cooldown > 0 || item.disabled || !canSync

  return (
    <div style={{ background: item.disabled ? 'var(--hover-bg)' : 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16,
                  opacity: item.disabled ? 0.55 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
          {item.viaCustomers && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--border)',
                           borderRadius: 4, padding: '1px 6px' }}>{t('sync.viaCustomers')}</span>
          )}
          {item.disabled && (
            <span style={{ fontSize: 10, color: 'var(--color-warning)', background: 'var(--color-warning-bg)',
                           border: '1px solid #FDE68A', borderRadius: 4, padding: '1px 6px' }}>
              {t('sync.comingSoon')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
        {running && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            {t('sync.busy')} {elapsed}s
          </div>
        )}
        {result && !running && (
          <div style={{ marginTop: 6, fontSize: 12,
                        color: result.started ? 'var(--color-info)' : result.ok ? 'var(--color-success)' : 'var(--color-danger)',
                        display: 'flex', alignItems: 'center', gap: 4 }}>
            {result.started ? <Clock size={11} /> : result.ok ? <Check size={11} /> : <AlertTriangle size={11} />}
            {result.msg}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <button onClick={run} disabled={blocked}
          title={!canSync ? t('sync.noPermission') : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8,
                   cursor: blocked ? 'not-allowed' : 'pointer',
                   border: `1px solid ${!canSync ? '#FCA5A5' : 'var(--border)'}`,
                   background: !canSync ? '#FFF5F5' : 'var(--hover-bg)',
                   color: !canSync ? 'var(--color-danger)' : 'var(--text)',
                   opacity: (running || cooldown > 0 || item.disabled) ? 0.5 : 1 }}>
          <RotateCcw size={13} className={running ? 'animate-spin' : ''} />
          {running ? `${elapsed}s…` : !canSync ? t('sync.noAccess') : t('sync.syncBtn')}
        </button>
        {cooldown > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {t('sync.cooldown')}: {cooldown}s
          </span>
        )}
      </div>
    </div>
  )
}

export default function SyncSettings() {
  const { t } = useTranslation('settings')
  const { user, hasPermission, isSuperAdmin, hasRole } = useAuth()
  const canSync = isSuperAdmin() || hasRole('planner') || hasRole('tenant_admin')
    || hasPermission('sync.refresh') || hasPermission('candidates.sync') || hasPermission('customers.sync')
  const [log, setLog] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sync_log') ?? '[]') } catch { return [] }
  })

  const addLog = (entry) => {
    setLog(prev => {
      const next = [entry, ...prev].slice(0, 50)
      sessionStorage.setItem('sync_log', JSON.stringify(next))
      return next
    })
  }

  return (
    <div>
      <div className="mb-5">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('sync.title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('sync.subtitle', { secs: COOLDOWN_SECS })}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {SYNC_ENDPOINTS.map(item => (
          <SyncRow key={item.key} item={item} user={user} canSync={canSync} onLog={addLog} />
        ))}
      </div>

      {log.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{t('sync.sessionLog')}</h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {log.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                    borderBottom: i < log.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: entry.ok ? 'var(--color-success)' : 'var(--color-danger)' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', width: 120, flexShrink: 0 }}>{entry.label}</span>
                <span style={{ fontSize: 12, color: entry.ok ? 'var(--color-success)' : 'var(--color-danger)', flex: 1 }}>{entry.msg}</span>
                {entry.elapsed && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.elapsed}s</span>}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{entry.user}</span>
                <span style={{ fontSize: 11, color: 'var(--border)', flexShrink: 0 }}>{entry.at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
