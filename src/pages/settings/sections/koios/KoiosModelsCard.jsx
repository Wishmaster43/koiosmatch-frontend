/**
 * KoiosModelsCard — the active model (highlighted) plus the list of selectable
 * models. Model ids render in monospace as they are stable identifiers.
 */
const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }
const label = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }
const chip = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'monospace',
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }

export default function KoiosModelsCard({ models, t }) {
  const active = models?.active
  const selectable = models?.selectable ?? []

  return (
    <div style={card}>
      <div style={cardTitle}>{t('models.title')}</div>

      <div style={label}>{t('models.active')}</div>
      <span style={{ ...chip, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', fontWeight: 600 }}>
        {active ?? '—'}
      </span>

      {selectable.length > 0 && (
        <>
          <div style={{ ...label, marginTop: 16 }}>{t('models.selectable')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selectable.map(m => (
              <span key={m} style={{ ...chip, fontWeight: m === active ? 600 : 400 }}>{m}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
