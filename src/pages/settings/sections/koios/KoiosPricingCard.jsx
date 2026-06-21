/**
 * KoiosPricingCard — input/output rate per 1M tokens for each model, formatted
 * in the active locale + the currency the API returns (defaults to EUR).
 */
const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }
const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }
const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)' }
const td = { fontSize: 12, color: 'var(--text)', padding: '8px', borderBottom: '1px solid var(--border)' }
const num = { ...td, fontFamily: 'monospace', textAlign: 'right' }

export default function KoiosPricingCard({ pricing, currency, locale, t }) {
  const entries = Object.entries(pricing ?? {})
  if (entries.length === 0) return null

  // Currency formatting in the active locale; falls back to EUR.
  const fmt = (v) => new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? 'EUR' }).format(v ?? 0)

  return (
    <div style={card}>
      <div style={cardTitle}>{t('pricing.title')}</div>
      <div style={sub}>{t('pricing.subtitle')}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{t('pricing.model')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('pricing.input')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('pricing.output')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([model, p]) => (
            <tr key={model}>
              <td style={{ ...td, fontFamily: 'monospace' }}>{model}</td>
              <td style={num}>{fmt(p?.input)}</td>
              <td style={num}>{fmt(p?.output)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
