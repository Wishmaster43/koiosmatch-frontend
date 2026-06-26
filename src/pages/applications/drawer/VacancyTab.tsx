import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApplicationDetail } from '../../../types/application'

// Neutral pill for skills/tags (no semantic colour — calm, like the screenshots).
function Pill({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap',
      background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
      {children}
    </span>
  )
}

/**
 * VacancyTab — read-only vacancy detail inside the application drawer: banner,
 * title/client, the key fields, required skills and tags.
 */
export default function VacancyTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const v = a.vacancy
  const skills = (v.skills ?? []) as string[]
  const tags   = (v.tags ?? []) as string[]

  // Field rows (label + value); skip empties so the grid stays tidy.
  const rows: [string, string][] = ([
    [t('vacancyDetail.id'), v.vacancyId],
    [t('vacancyDetail.status'), v.status],
    [t('vacancyDetail.employment'), v.employmentType],
    [t('vacancyDetail.location'), v.location],
    [t('vacancyDetail.salary'), v.salary],
    [t('vacancyDetail.hours'), v.hours],
    [t('vacancyDetail.experience'), v.experience],
    [t('vacancyDetail.seniority'), v.seniority],
    [t('vacancyDetail.education'), v.education],
    [t('vacancyDetail.branch'), v.branch],
    [t('vacancyDetail.category'), v.category],
  ] as [string, string][]).filter(([, value]) => value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Banner + title */}
      <div>
        <div style={{ height: 80, borderRadius: 12, background: 'linear-gradient(135deg,#F97316,#FBBF24)' }} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{v.title || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.client || '—'}</div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Required skills */}
      {skills.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{t('vacancyDetail.skills')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{skills.map(s => <Pill key={s}>{s}</Pill>)}</div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{t('vacancyDetail.tags')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{tags.map(tg => <Pill key={tg}>{tg}</Pill>)}</div>
        </div>
      )}
    </div>
  )
}
