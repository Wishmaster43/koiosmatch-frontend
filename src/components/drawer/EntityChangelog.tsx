/**
 * EntityChangelog — generic ChangelogPopover CONTENT for any entity that has no
 * bespoke `<Entity>/drawer/ChangelogTab.tsx` yet (CHANGELOG-OVERAL-1). Fetches
 * `GET /activity-log?subject_type=&subject_id=` (the same endpoint the settings
 * AuditLog screen reads) and renders the uniform CHANGELOG-3 shape — time · who ·
 * event, then one old → new row per changed field — via the SAME buildFieldDiff
 * helper the audit table/drawer already use, so the render rules never drift.
 * `subjectId` is optional: omitting it (settings screens) filters by type only.
 * CHANGELOG-ACTOR-LABEL: the "who" reads `actor_label` first — a Koios-performed
 * action logs `"<name>-KoiosAI"` there, next to the human `causer_name` its own
 * account ran under — falling back to `causer_name`, then the system label.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { buildFieldDiff } from '@/pages/settings/shared'
import type { Id } from '@/types/common'
import { Caption } from '@/components/ui/typography'

interface ActivityEntry {
  id?: Id
  description?: string
  event?: string
  causer_name?: string
  // CHANGELOG-ACTOR-LABEL: set for every Koios-performed action ("<name>-KoiosAI"),
  // alongside causer_name — takes priority so an automated change reads as Koios,
  // not as the human whose account the automation ran under.
  actor_label?: string
  created_at?: string
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
}

// `logName` instead of `subjectType` for the manually-audited streams (settings,
// apikeys, …): those log via activity('<name>') WITHOUT performedOn, so their
// subject_type is NULL — filtering on it returns nothing (verified 14-08,
// ActivityLogController). Exactly one of the two must be given.
export default function EntityChangelog({ subjectType, subjectId, logName, endpoint }: { subjectType?: string; subjectId?: Id; logName?: string; endpoint?: string }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // One fetch per subject — the shared ChangelogPopover shell only mounts this
  // content while its panel is open. Aborted on subject change/unmount.
  useEffect(() => {
    if (!subjectType && !logName && !endpoint) return
    const ctrl = new AbortController()
    const params: Record<string, string | Id> = subjectType ? { subject_type: subjectType } : { log_name: logName as string }
    if (subjectType && subjectId !== undefined && subjectId !== null) params.subject_id = subjectId
    setLoading(true)
    setError(false)
    // F1c: an entity with a DEDICATED /…/activity route (same controller shape as
    // /candidates|/vacancies) passes it via `endpoint`; params only apply to the
    // generic /activity-log form.
    api.get(endpoint ?? '/activity-log', endpoint ? { signal: ctrl.signal } : { params, signal: ctrl.signal })
      // Array guard (CHANGELOG-FLAKE-1): a malformed/non-list payload must render
      // the empty state, never crash items.map in an async window.
      .then(res => { const rows = unwrapList<ActivityEntry>(res).rows; setItems(Array.isArray(rows) ? rows : []) })
      // A failed fetch must render as an error, never silently as "no entries"
      // (an audit trail staying reassuring-but-wrong is a GDPR-sensitive bug).
      .catch(() => { if (!ctrl.signal.aborted) { setItems([]); setError(true) } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [subjectType, subjectId, logName, endpoint])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('audit.loading')}</div>
  if (error) return <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('audit.unavailable')}</div>
  if (items.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('audit.noEntries')}</div>

  return (
    <>
      {items.map((entry, i) => {
        const rows = buildFieldDiff(entry, t)
        return (
          <div key={entry.id ?? i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
            <Caption as="div">
              {entry.created_at ? formatDateTime(entry.created_at) : '—'}
              {' · '}{entry.actor_label ?? entry.causer_name ?? t('audit.system')}{' · '}{entry.description ?? entry.event ?? '—'}
            </Caption>
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
