/**
 * DetailTable — read-only list of label/value rows.
 *
 * Replaces the repeated `[['Label', value], …].map(...)` blocks in the drawer
 * (plaatsingen, dienst-detail, inplanning, statistieken). Empty values show "-".
 *
 * rows: Array<[label, value]>
 */
export default function DetailTable({ rows = [], labelWidth = 130, lastBorder = true }) {
  return (
    <>
      {rows.map(([label, value], i) => (
        <div key={label} style={{
          display: 'flex', gap: 16, padding: '9px 12px', background: 'var(--surface)',
          borderBottom: (lastBorder || i < rows.length - 1) ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{value || '-'}</span>
        </div>
      ))}
    </>
  )
}
