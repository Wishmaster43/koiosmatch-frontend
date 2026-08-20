/**
 * AttentionCandidates — a recruitment dashboard block: the candidates a recruiter
 * should work through, grouped by why (not-contacted >6m · never contacted · no
 * follow-up). Owner-scoped by the backend feed; self-hides when empty. Each group
 * carries { total, rows }: rows is the capped, longest-waiting-first sample; when
 * total exceeds the sample a "see all" link opens the candidates page pre-filtered
 * to that exact attention group (the same intent the candidates KPI tiles emit).
 * Click a candidate → the candidate drawer.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import StatusPill from '@/components/ui/StatusPill'
import type { AttentionGroup } from '@/types/dashboard'

type Groups = { stale6m?: AttentionGroup; never_contacted?: AttentionGroup; no_followup?: AttentionGroup }

// Group key → i18n label + accent colour + the candidates-page attention intent
// value (CandidatesPage:113 / dashboardKpis convention, onNavigate('candidates',
// { attention: '<value>' })).
const GROUPS: Array<{ key: keyof Groups; i18n: string; color: string; intent: string }> = [
  { key: 'stale6m',         i18n: 'stale6m',        color: 'var(--color-warning)', intent: 'stale6m' },
  { key: 'never_contacted', i18n: 'neverContacted', color: 'var(--color-danger-text)',  intent: 'neverContacted' },
  { key: 'no_followup',     i18n: 'noFollowup',     color: 'var(--color-secondary)', intent: 'noFollowup' },
]

export default function AttentionCandidates({ groups, onOpen, onNavigate }: {
  groups?: Groups
  onOpen?: (id: string | number) => void
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  const { statusMeta } = useLookups()
  const g = groups ?? {}
  const total = GROUPS.reduce((n, x) => n + (g[x.key]?.total ?? 0), 0)
  if (total === 0) return null

  // Last-contact date, house format; empty (not the dash) so a missing date stays clean.
  const fmtDate = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : formatDate(d)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {t('block.attentionTitle')}
      </div>
      {GROUPS.map(grp => {
        const group = g[grp.key]
        const rows = group?.rows ?? []
        if (!group || group.total === 0) return null
        const hasMore = group.total > rows.length
        return (
          <div key={grp.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: grp.color, flexShrink: 0 }} />
              {t(`attentionGroup.${grp.i18n}`)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {group.total}</span>
            </div>
            {rows.map((c, i) => {
              const clickable = Boolean(onOpen && c.id != null)
              const meta = c.status_value ? statusMeta(c.status_value) : null
              return (
                <div key={c.id ?? i} {...interactive(clickable ? () => onOpen?.(c.id!) : undefined)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: clickable ? 'pointer' : 'default' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</span>
                  {meta && <StatusPill label={meta.label} color={meta.color} />}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDate(c.last_contact_at)}</span>
                </div>
              )
            })}
            {hasMore && (
              <div {...interactive(onNavigate ? () => onNavigate('candidates', { attention: grp.intent }) : undefined)}
                style={{ padding: '6px 16px 10px', fontSize: 12, color: 'var(--color-primary-text)', cursor: onNavigate ? 'pointer' : 'default' }}>
                {t('block.seeAll', { count: group.total })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
