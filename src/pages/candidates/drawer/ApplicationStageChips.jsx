/**
 * ApplicationStageChips — read-only chips showing each application's stage for
 * this candidate (one chip per application: stage · vacancy). Only meaningful
 * for applicants, so it renders nothing when there are no linked applications.
 *
 * The stage itself is edited in the application drawer (the ATS pipeline), not
 * here — hence read-only. Pass `onOpen` to make a chip jump to its application.
 *
 * applications: Array<{ id, vacancyTitle, stageLabel, stageColor }>
 */
export default function ApplicationStageChips({ applications = [], label, onOpen }) {
  // Nothing to show for non-applicants — keeps the header calm by default.
  if (!applications.length) return null

  const clickable = typeof onOpen === 'function'

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {applications.map(app => {
          // Soft chip — same tint convention as the candidate-type chips.
          const color = app.stageColor || '#6B7280'
          return (
            <button key={app.id} type="button" disabled={!clickable}
              onClick={clickable ? () => onOpen(app) : undefined}
              title={app.vacancyTitle}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                cursor: clickable ? 'pointer' : 'default',
                background: color + '1A', border: `1px solid ${color}55`, color }}>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{app.stageLabel}</span>
              {app.vacancyTitle && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  · {app.vacancyTitle}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
