/** PlaceholderSettings — simple centered title/description placeholder for sections
 * that are not built out yet (billing, app store). */
export default function PlaceholderSettings({ title, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 260, color: 'var(--text-muted)', gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  )
}
