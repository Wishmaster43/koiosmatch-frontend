import { useTranslation } from 'react-i18next'
import Avatar from '../../../components/ui/Avatar'
import StatusPill from '../../../components/ui/StatusPill'
import Timeline from './Timeline'

// A small label-above-value field.
function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

/**
 * CandidateTab — read-only candidate summary inside the application drawer:
 * header + profile fields + the application timeline. The full editable record
 * lives in the Candidates feature.
 */
export default function CandidateTab({ application: a }) {
  const { t } = useTranslation('applications')
  const c = a.candidate ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={c.initials ?? a.candidateInitials} size={44} soft />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name ?? a.candidateName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.function || t('profile.function')}</div>
        </div>
        {c.statusLabel && <StatusPill label={c.statusLabel} color={c.statusColor} />}
      </div>

      {/* Profile fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
        <Field label={t('profile.gender')}>{c.gender || '—'}</Field>
        <Field label={t('profile.nationality')}>{c.nationality || '—'}</Field>
        <Field label={t('profile.dob')}>{c.dob || '—'}</Field>
        <Field label={t('profile.email')}>{c.email || '—'}</Field>
        <Field label={t('profile.phone')}>{c.phone || '—'}</Field>
        <Field label={t('profile.address')}>{c.address || '—'}</Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label={t('profile.summary')}>{c.summary || '—'}</Field>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('profile.timeline')}</div>
        <Timeline items={a.timeline ?? []} emptyText={t('timeline.empty')} />
      </div>
    </div>
  )
}
