/**
 * AuditDrawer — drill-down for one audit entry: before/after diff (DiffRow) per
 * changed field. Extracted from AuditLog.
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eye } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { KPI_KEYS, LogBadge, isAccessEvent, buildFieldDiff, entityLabel } from './auditShared'

function DiffRow({ label, before, after }) {
  const { t } = useTranslation('settings')
  const changed = JSON.stringify(before) !== JSON.stringify(after)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid var(--hover-bg)', alignItems: 'start' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ fontSize: 12, background: changed ? 'var(--color-danger-bg)' : 'var(--hover-bg)',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-danger)' : 'var(--text-muted)',
                    wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {Array.isArray(before) ? (before.length ? before.join(', ') : t('audit.none')) : String(before ?? '—')}
      </div>
      <div style={{ fontSize: 12, background: changed ? 'var(--color-success-bg)' : 'var(--hover-bg)',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-success)' : 'var(--text-muted)',
                    wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {Array.isArray(after)  ? (after.length  ? after.join(', ')  : t('audit.none')) : String(after  ?? '—')}
      </div>
    </div>
  )
}

export function AuditDrawer({ entry, onClose }) {
  const { t } = useTranslation('settings')
  // Focus-trapped dialog (§6, WCAG 2.2 AA): Escape closes it, Tab stays inside,
  // focus returns to the triggering row on close — same behaviour as every other
  // drawer/modal in the app (RightDrawer et al.), which this one had drifted from.
  const panelRef = useFocusTrap(onClose)
  const p = entry.properties ?? {}
  const logName = entry.log_name
  const kpiLabel = (k) => KPI_KEYS.includes(k) ? t(`audit.kpi.${k}`) : k

  const renderContent = () => {
    // Access (read) events — the AVG "Dossier geopend/ingezien" compliance log. These
    // never carry an old→new diff by design, so they get their own compact panel
    // instead of a dash-filled diff grid (Danny/CMBE 2026-07-14: visually distinct).
    if (isAccessEvent(entry)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--hover-bg)' }}>
            <Eye size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{t('audit.accessNotice')}</span>
          </div>
          {[
            { label: t('audit.colEntity'), value: entry.subject_type ? [entityLabel(entry.subject_type, t), entry.subject_label].filter(Boolean).join(' · ') : '—' },
            { label: t('audit.auth.ip'), value: p.ip ?? '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'http') {
      const method  = p.method ?? '—'
      const status  = p.status
      const isOk    = status >= 200 && status < 300
      const isErr   = status >= 400
      const statusColor = isOk ? 'var(--color-success)' : isErr ? 'var(--color-danger)' : 'var(--color-warning)'
      const statusBg    = isOk ? 'var(--color-success-bg)' : isErr ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 16px', alignItems: 'start' }}>
            {[
              { label: t('audit.http.method'), value: method, mono: true },
              { label: t('audit.http.path'),   value: p.path ?? p.url ?? '—', mono: true },
              { label: t('audit.http.status'), value: status, statusColor, statusBg },
              { label: t('audit.http.duration'), value: p.duration ?? '—' },
            ].map(row => (
              <Fragment key={row.label}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{row.label}</span>
                <span style={{ fontSize: 13, color: row.statusColor ?? 'var(--text)',
                                    background: row.statusBg ?? 'transparent',
                                    borderRadius: row.statusBg ? 6 : 0,
                                    padding: row.statusBg ? '1px 7px' : 0,
                                    fontFamily: row.mono ? 'monospace' : 'inherit',
                                    fontWeight: row.statusColor ? 700 : 400 }}>
                  {row.value ?? '—'}
                </span>
              </Fragment>
            ))}
          </div>
          {p.payload && Object.keys(p.payload).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('audit.http.payload')}</div>
              <pre style={{ fontSize: 11, fontFamily: 'monospace', background: '#1E1E2E', color: '#A8E6CF',
                             borderRadius: 8, padding: '10px 14px', overflow: 'auto', maxHeight: 200,
                             margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(p.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    if (logName === 'auth') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: t('audit.auth.action'),  value: p.action ?? entry.description },
            { label: t('audit.auth.ip'),      value: p.ip ?? p.ip_address ?? '—' },
            { label: t('audit.auth.browser'), value: p.user_agent ?? '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'sync') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: t('audit.sync.synced'),      value: p.synced ?? p.customers ?? p.candidates ?? '—', color: 'var(--color-success)' },
            { label: t('audit.sync.total'),       value: p.total ?? '—' },
            { label: t('audit.sync.errors'),      value: p.errors ?? '0', color: p.errors > 0 ? 'var(--color-danger)' : undefined },
            { label: t('audit.sync.duration'),    value: p.duration ?? '—' },
            { label: t('audit.sync.locations'),   value: p.locations },
            { label: t('audit.sync.departments'), value: p.departments },
          ].filter(r => r.value !== undefined && r.value !== null).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: r.color ?? 'var(--text)' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'roles' && p.before !== undefined && p.after !== undefined) {
      const allPerms = [...new Set([...(p.before ?? []), ...(p.after ?? [])])].sort()
      const added    = (p.after ?? []).filter(x => !(p.before ?? []).includes(x))
      const removed  = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                        padding: '6px 0', marginBottom: 4 }}>
            <span />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('audit.before')}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('audit.after')}</span>
          </div>
          {allPerms.map(perm => (
            <DiffRow key={perm} label={perm}
              before={(p.before ?? []).includes(perm) ? t('audit.active') : t('audit.inactive')}
              after={(p.after  ?? []).includes(perm) ? t('audit.active') : t('audit.inactive')} />
          ))}
          {(added.length > 0 || removed.length > 0) && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              {added.length > 0 && (
                <div style={{ flex: 1, background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', marginBottom: 6 }}>
                    {t('audit.addedCount', { count: added.length })}
                  </div>
                  {added.map(perm => <div key={perm} style={{ fontSize: 12, color: 'var(--text)' }}>{perm}</div>)}
                </div>
              )}
              {removed.length > 0 && (
                <div style={{ flex: 1, background: 'var(--color-danger-bg)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 6 }}>
                    {t('audit.removedCount', { count: removed.length })}
                  </div>
                  {removed.map(perm => <div key={perm} style={{ fontSize: 12, color: 'var(--text)' }}>{perm}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    if (logName === 'settings') {
      if (p.before && p.after) {
        const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
        const unchanged = Object.keys(p.after).filter(k => String(p.before[k]) === String(p.after[k]))
        return (
          <div>
            {changed.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  {t('audit.changedCount', { count: changed.length })}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8,
                              padding: '6px 0', marginBottom: 4 }}>
                  <span />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)' }}>{t('audit.oldValue')}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)' }}>{t('audit.newValue')}</span>
                </div>
                {changed.map(k => (
                  <DiffRow key={k} label={kpiLabel(k)} before={p.before[k] ?? '—'} after={p.after[k]} />
                ))}
              </>
            )}
            {unchanged.length > 0 && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {t('audit.unchangedCount', { count: unchanged.length })}
                </summary>
                <div style={{ marginTop: 8 }}>
                  {unchanged.map(k => (
                    <DiffRow key={k} label={kpiLabel(k)} before={p.before[k]} after={p.after[k]} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      }
      const keys = p.keys ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {t('audit.settingsUpdated', { count: keys.length })}
          </p>
          {keys.map(k => (
            <div key={k} style={{ background: 'var(--hover-bg)', borderRadius: 8, padding: '8px 12px',
                                   fontSize: 12, color: 'var(--text)', fontFamily: 'monospace' }}>{kpiLabel(k)}</div>
          ))}
        </div>
      )
    }

    // Generalised entity write (CHANGELOG-3 uniform shape: `entry.changes =
    // {attributes, old}`, a top-level sibling of `properties` — NOT nested inside
    // it). Renders exactly like the per-entity changelog popover (ChangelogTab):
    // "field: old → new" per changed field, noise fields dropped, CREATE only lists
    // fields that got a value. Covers every AuditsChanges model (candidate, vacancy,
    // task, opportunity, match, customer + locations/departments/contacts, …).
    const diffRows = buildFieldDiff(entry, t)
    if (diffRows.length > 0) {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8, padding: '6px 0', marginBottom: 4 }}>
            <span />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)' }}>{t('audit.oldValue')}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)' }}>{t('audit.newValue')}</span>
          </div>
          {diffRows.map(row => (
            <DiffRow key={row.field} label={row.label} before={row.before} after={row.after} />
          ))}
        </div>
      )
    }

    // Generic fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(p).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--hover-bg)',
                                borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={entry.description} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <LogBadge logName={entry.log_name} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{entry.description}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{entry.causer_name ?? t('audit.system')}</strong>
                {entry.causer_email && <span> · {entry.causer_email}</span>}
                <span> · {new Date(entry.created_at).toLocaleString(undefined, {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
            </div>
            <button onClick={onClose} aria-label={t('common.close')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {renderContent()}
        </div>
      </div>
    </>
  )
}

