/**
 * EntityChangelog — generic ChangelogPopover CONTENT for any entity that has no
 * bespoke `<Entity>/drawer/ChangelogTab.tsx` yet (CHANGELOG-OVERAL-1). Fetches
 * `GET /activity-log?subject_type=&subject_id=` (the same endpoint the settings
 * AuditLog screen reads) and renders the uniform CHANGELOG-3 shape — time · who ·
 * event, then one old → new row per changed field — via the SAME buildFieldDiff
 * helper the audit table/drawer already use, so the render rules never drift.
 * `subjectId` is optional: omitting it (settings screens) filters by type only.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { buildFieldDiff } from '@/pages/settings/shared'
import type { Id } from '@/types/common'

interface ActivityEntry {
  id?: Id
  description?: string
  event?: string
  causer_name?: string
  created_at?: string
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
}

// `logName` instead of `subjectType` for the manually-audited streams (settings,
// apikeys, …): those log via activity('<name>') WITHOUT performedOn, so their
// subject_type is NULL — filtering on it returns nothing (verified 14-08,
// ActivityLogController). Exactly one of the two must be given.
export default function EntityChangelog({ subjectType, subjectId, logName }: { subjectType?: string; subjectId?: Id; logName?: string }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  // One fetch per subject — the shared ChangelogPopover shell only mounts this
  // content while its panel is open. Aborted on subject change/unmount.
  useEffect(() => {
    if (!subjectType && !logName) return
    const ctrl = new AbortController()
    const params: Record<string, string | Id> = subjectType ? { subject_type: subjectType } : { log_name: logName as string }
    if (subjectType && subjectId !== undefined && subjectId !== null) params.subject_id = subjectId
    setLoading(true)
    api.get('/activity-log', { params, signal: ctrl.signal })
      .then(res => setItems(unwrapList<ActivityEntry>(res).rows))
      .catch(() => { if (!ctrl.signal.aborted) setItems([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [subjectType, subjectId, logName])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('audit.loading')}</div>
  if (items.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('audit.noEntries')}</div>

  return (
    <>
      {items.map((entry, i) => {
        const rows = buildFieldDiff(entry, t)
        return (
          <div key={entry.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {entry.created_at ? formatDateTime(entry.created_at) : '—'}
              {' · '}{entry.causer_name ?? t('audit.system')}{' · '}{entry.description ?? entry.event ?? '—'}
            </div>
            {rows.length > 0 ? (
              rows.map(row => (
                <div key={row.field} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 12 }}>
                  <span style={{ width: 120, flexShrink: 0, color: 'var(--text)', fontWeight: 600 }}>{row.label}</span>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{row.before}</span>
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text)' }}>{row.after}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 5 }}>{entry.description ?? '—'}</div>
            )}
          </div>
        )
      })}
    </>
  )
}
