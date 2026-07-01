/**
 * AttentionCandidates — a recruitment dashboard block: the candidates a recruiter
 * should work through, grouped by why (not-contacted >6m · never contacted · no
 * follow-up). Owner-scoped by the backend feed; self-hides when empty. Click a
 * candidate → the candidate drawer.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import type { AttentionCandidate } from '@/types/dashboard'

type Groups = { stale6m?: AttentionCandidate[]; never_contacted?: AttentionCandidate[]; no_followup?: AttentionCandidate[] }

// Group key → i18n label + accent colour.
const GROUPS: Array<{ key: keyof Groups; i18n: string; color: string }> = [
  { key: 'stale6m',         i18n: 'stale6m',        color: 'var(--color-warning)' },
  { key: 'never_contacted', i18n: 'neverContacted', color: 'var(--color-danger)' },
  { key: 'no_followup',     i18n: 'noFollowup',     color: 'var(--color-secondary)' },
]

export default function AttentionCandidates({ groups, onOpen }: {
  groups?: Groups
  onOpen?: (id: string | number) => void
}) {
  const { t } = useTranslation('dashboard')
  const g = groups ?? {}
  const total = GROUPS.reduce((n, x) => n + (g[x.key]?.length ?? 0), 0)
  if (total === 0) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {t('block.attentionTitle')}
      </div>
      {GROUPS.map(grp => {
        const list = g[grp.key] ?? []
        if (!list.length) return null
        return (
          <div key={grp.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: grp.color, flexShrink: 0 }} />
              {t(`attentionGroup.${grp.i18n}`)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {list.length}</span>
            </div>
            {list.map((c, i) => {
              const clickable = Boolean(onOpen && c.id != null)
              return (
                <div key={c.id ?? i} {...interactive(clickable ? () => onOpen?.(c.id!) : undefined)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: clickable ? 'pointer' : 'default' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
