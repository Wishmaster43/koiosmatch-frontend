/**
 * MessagingCosts — read-only usage + cost breakdown for the tenant. Shape per the
 * backend contract: { usage, cost{numbers, waba_messages, base, total}, by_number[] }.
 * Money is formatted with Intl in the active locale (EUR). Defensive about
 * optional fields so a partial payload still renders.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale } from '../../../../lib/datetime'
import { getCosts } from './messagingApi'

export default function MessagingCosts() {
  const { t } = useTranslation('settings')
  const locale = useLocale()
  const [data, setData]   = useState(null)
  const [phase, setPhase] = useState('loading')   // loading | error | ready

  useEffect(() => {
    getCosts()
      .then((d) => { setData(d ?? {}); setPhase('ready') })
      .catch(() => setPhase('error'))
  }, [])

  // Format a number as EUR currency; '—' for missing values.
  const money = (v) => (v == null || Number.isNaN(Number(v)))
    ? '—'
    : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(v))

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'error')   return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('messaging.loadError')}</p>

  const cost = data?.cost ?? {}
  const byNumber = Array.isArray(data?.by_number) ? data.by_number : []
  // Cost lines in display order; total is highlighted.
  const lines = [
    ['numbers', t('messaging.costs.numbers'), cost.numbers],
    ['waba_messages', t('messaging.costs.waba'), cost.waba_messages],
    ['base', t('messaging.costs.base'), cost.base],
  ]

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('messaging.costs.subtitle')}</p>

      {/* Cost breakdown */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {lines.map(([key, label, val], i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
            <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{money(val)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '2px solid var(--border)', background: 'var(--hover-bg)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('messaging.costs.total')}</span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{money(cost.total)}</span>
        </div>
      </div>

      {/* Per-number breakdown */}
      {byNumber.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{t('messaging.costs.byNumber')}</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {byNumber.map((row, i) => (
              <div key={row.number ?? row.phone ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{row.number ?? row.phone ?? '—'}</span>
                <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {row.messages != null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('messaging.costs.messages', { count: row.messages })}</span>}
                  <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{money(row.cost ?? row.total)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
