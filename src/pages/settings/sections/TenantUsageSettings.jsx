/**
 * TenantUsageSettings — super-admin usage overview per tenant (for manual invoicing).
 * Quantities only — no prices, no PII. Primary source: GET /admin/usage (all tenants);
 * falls back to the active tenant's GET /admin/tenants/{id}/usage until that list
 * endpoint is live. Credits are derived client-side from ai.tokens (per the contract).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'))

// Compact connector summary: total non-zero usage + a per-connector tooltip.
const connectorSummary = (list) => {
  const arr = Array.isArray(list) ? list.filter(c => (c?.usage ?? 0) > 0) : []
  if (!arr.length) return { text: '—', title: '' }
  return {
    text:  arr.reduce((s, c) => s + (c.usage ?? 0), 0).toLocaleString('nl-NL'),
    title: arr.map(c => `${c.key}: ${c.usage}`).join(' · '),
  }
}

const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td = { fontSize: 13, color: 'var(--text)', padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const tdNum = { ...td, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }

export default function TenantUsageSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant } = useAuth()
  const [rows,  setRows]  = useState([])
  const [phase, setPhase] = useState('loading') // loading | ready | error

  useEffect(() => {
    const ctrl = new AbortController()
    // Prefer the all-tenants overview; fall back to the active tenant only.
    api.get('/admin/usage', { signal: ctrl.signal })
      .then(res => { setRows(res.data?.data ?? res.data ?? []); setPhase('ready') })
      .catch(() => {
        if (!activeTenant?.id) { setPhase('error'); return }
        api.get(`/admin/tenants/${activeTenant.id}/usage`, { signal: ctrl.signal })
          .then(res => {
            const u = res.data?.data ?? res.data ?? {}
            setRows([{ tenant_id: activeTenant.id, name: activeTenant.name ?? '—', ...u }])
            setPhase('ready')
          })
          .catch(() => setPhase('error'))
      })
    return () => ctrl.abort()
  }, [activeTenant?.id, activeTenant?.name])

  const note = (txt) => <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{txt}</p>
  if (phase === 'loading') return note(t('common.loadingShort'))
  if (phase === 'error')   return note(t('usage.loadError', { defaultValue: 'Verbruik laden is mislukt.' }))
  if (!Array.isArray(rows) || rows.length === 0) return note(t('usage.empty', { defaultValue: 'Nog geen verbruik geregistreerd.' }))

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('usage.subtitle', { defaultValue: 'Verbruik per klant (hoeveelheden) — bereken de bedragen zelf voor je facturatie.' })}
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--surface-alt, #F9FAFB)' }}>
              <th style={th}>{t('usage.col.tenant', { defaultValue: 'Klant' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.aiTokens', { defaultValue: 'AI-tokens' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.aiCalls', { defaultValue: 'AI-calls' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.waBusiness', { defaultValue: 'WA Business' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.waPrivate', { defaultValue: 'WA privé' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.hours', { defaultValue: 'Uren' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('usage.col.connectors', { defaultValue: 'Connectors' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const conn = connectorSummary(r.connectors)
              return (
                <tr key={r.tenant_id ?? i}>
                  <td style={{ ...td, fontWeight: 500 }}>{r.name ?? r.tenant_id ?? '—'}</td>
                  <td style={tdNum}>{num(r.ai?.tokens)}</td>
                  <td style={tdNum}>{num(r.ai?.requests)}</td>
                  <td style={tdNum}>{num(r.whatsapp?.business_numbers)}</td>
                  <td style={tdNum}>{num(r.whatsapp?.private_numbers)}</td>
                  <td style={tdNum}>{num(r.planning?.processed_hours)}</td>
                  <td style={tdNum} title={conn.title}>{conn.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <BarChart2 size={13} />
        {t('usage.footnote', { defaultValue: 'Credits leid je af uit AI-tokens. Alleen hoeveelheden — geen tarieven.' })}
      </div>
    </div>
  )
}
