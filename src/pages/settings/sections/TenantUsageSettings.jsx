/**
 * TenantUsageSettings — usage for the ACTIVE (selected) tenant ONLY. The super-admin
 * switches the tenant; this shows that one customer's usage for manual invoicing.
 * NEVER an all-tenants list. Quantities only — no prices, no PII.
 * Source: GET /admin/tenants/{id}/usage?month=YYYY-MM. Month selector = history.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'))

// Connector key → brand label (proper nouns, not translatable).
const CONNECTOR_LABELS = { sm: 'ShiftManager', hf: 'HelloFlex', intus: 'Intus', elanza: 'Elanza', aelio: 'Aelio' }

// Build the last 12 months as { value: 'YYYY-MM', label } — newest first.
function buildMonths() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    return { value, label }
  })
}

// Small metric tile.
function Tile({ label, value }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 130, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  )
}

export default function TenantUsageSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant } = useAuth()
  const months = useMemo(() => buildMonths(), [])
  const [month, setMonth] = useState(months[0].value) // current month by default
  const [usage, setUsage] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | error

  // Fetch the ACTIVE tenant's usage for the selected month — refetch on tenant or month change.
  useEffect(() => {
    if (!activeTenant?.id) { setPhase('error'); return }
    const ctrl = new AbortController()
    setPhase('loading')
    api.get(`/admin/tenants/${activeTenant.id}/usage`, { params: { month }, signal: ctrl.signal })
      .then(res => { setUsage(res.data?.data ?? res.data ?? {}); setPhase('ready') })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [activeTenant?.id, month])

  const connectors = Array.isArray(usage?.connectors) ? usage.connectors : []

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Tenant + month selector — super-admin switches the tenant; the month picker is the history */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {t('usage.subtitleTenant', {
            name: activeTenant?.name ?? '—',
            defaultValue: 'Verbruik van {{name}} — alleen hoeveelheden voor je facturatie.',
          })}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.month', { defaultValue: 'Maand' })}</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', textTransform: 'capitalize', cursor: 'pointer' }}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {phase === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('common.loadingShort', { defaultValue: 'Laden…' })}</p>}
      {phase === 'error'   && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.loadError', { defaultValue: 'Verbruik laden is mislukt.' })}</p>}

      {phase === 'ready' && (
        <>
          {/* Metric tiles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            <Tile label={t('usage.col.aiTokens', { defaultValue: 'AI-tokens' })}   value={num(usage?.ai?.tokens)} />
            <Tile label={t('usage.col.aiCalls', { defaultValue: 'AI-calls' })}     value={num(usage?.ai?.requests)} />
            <Tile label={t('usage.col.waBusiness', { defaultValue: 'WhatsApp Business' })} value={num(usage?.whatsapp?.business_numbers)} />
            <Tile label={t('usage.col.waPrivate', { defaultValue: 'WhatsApp privé' })}     value={num(usage?.whatsapp?.private_numbers)} />
            <Tile label={t('usage.col.hours', { defaultValue: 'Verwerkte uren' })}  value={num(usage?.planning?.processed_hours)} />
          </div>

          {/* Connectors (per connector — for invoicing) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 10 }}>
            {t('usage.col.connectors', { defaultValue: 'Connectors' })}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {connectors.length === 0
              ? <div style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-muted)' }}>—</div>
              : connectors.map((c, i) => (
                <div key={c.key ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{CONNECTOR_LABELS[c.key] ?? c.key}</span>
                  <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{num(c.usage)}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
