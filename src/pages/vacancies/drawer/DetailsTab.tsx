import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import DetailTableJs from '../../../components/ui/DetailTable'
import type { VacancyDetail } from '../../../types/vacancy'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

// Titled card wrapper — one per related field group (General / Requirements / …).
function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

/**
 * DetailsTab — read-only vacancy field grid grouped in titled cards, plus the
 * required-skills list and the description. Mirrors the candidate Profile layout
 * (label-above, grouped cards). In-place edit follows in a later round (B-19).
 */
export default function DetailsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')

  const general = [
    [t('details.id'), v.code],
    [t('details.employmentType'), v.employmentLabel],
    [t('details.location'), v.location],
    [t('details.industry'), v.industry],
    [t('details.category'), v.category],
  ]
  const requirements = [
    [t('details.experience'), v.experience],
    [t('details.seniority'), v.seniority],
    [t('details.education'), v.education],
  ]
  const conditions = [
    [t('details.salary'), v.salary],
    [t('details.hours'), v.hours],
  ]

  return (
    <div>
      <Card title={t('details.groups.general')}><DetailTable rows={general} lastBorder={false} /></Card>
      <Card title={t('details.groups.requirements')}><DetailTable rows={requirements} lastBorder={false} /></Card>
      <Card title={t('details.groups.conditions')}><DetailTable rows={conditions} lastBorder={false} /></Card>

      {/* Required skills — vertical list (candidate convention), not inline chips. */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('details.skills')}</div>
        {(v.skills?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.noSkills')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {v.skills.map((s, i) => {
              const so = s as { name?: string; label?: string }
              return (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '6px 10px',
                  border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                  {typeof s === 'string' ? s : (so.name ?? so.label ?? '')}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('details.description')}</div>
        {v.description
          ? <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{v.description}</div>
          : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
      </div>
    </div>
  )
}
