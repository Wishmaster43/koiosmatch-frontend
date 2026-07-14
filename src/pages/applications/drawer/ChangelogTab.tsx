/**
 * ChangelogTab — the application's FIELD-CHANGE audit trail (icon-popover, §3A(d)).
 * Presentational; the fetch lives in useApplicationActivity (§3). Handles the four
 * UI states explicitly and shows a calm empty state until the backend read endpoint
 * is live (404 → empty). Mirrors the opportunity/match changelog so every entity
 * reads the same (§3A). Distinct from the Tijdlijn TAB (Timeline.tsx, fed by
 * `application.timeline` / ApplicationTimeline on the backend): the tab aggregates
 * real lifecycle activity (funnel transitions, appointments, notes, AI-interviews)
 * in human terms, this icon shows the raw audit diff — tab = activiteit, icon =
 * veldwijzigingen. A pure funnel-stage transition already reads clearly on the
 * Tijdlijn tab ("Fase gewijzigd: A → B"), so it is filtered out of THIS feed below
 * to avoid showing the same transition twice with two different phrasings.
 */
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useApplicationActivity, type ApplicationActivityEvent } from '../hooks/useApplicationActivity'
import type { ApplicationDetail } from '@/types/application'

// True when the ONLY field this audit entry changed is the funnel stage — that
// exact transition already has a readable row on the Tijdlijn tab, so repeating a
// bare "updated" row here would just be visual noise (dedupe, §3A(d) decision).
const isStageOnlyChange = (ev: ApplicationActivityEvent): boolean => {
  const keys = Object.keys(ev.changes?.attributes ?? {})
  return keys.length === 1 && keys[0] === 'application_stage_id'
}

export default function ChangelogTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()
  const { items: rawItems, loading, error } = useApplicationActivity(a?.id)
  const items = rawItems.filter(ev => !isStageOnlyChange(ev))

  return (
    <div>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {t('changelog.error')}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <History size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
        </div>
      )}

      {!loading && !error && items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
          <Avatar initials={initialsOf(ev.causer_name)} size={26} soft />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.causer_name || t('changelog.system')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(ev.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.description || ev.log_name}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
