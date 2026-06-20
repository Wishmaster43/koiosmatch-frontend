/**
 * SectionTabs — the candidate's list sections (experience, education, languages,
 * certifications, skills). Each is a thin config on the shared AddableSection.
 */
import { useTranslation } from 'react-i18next'
import { GripVertical } from 'lucide-react'
import AddableSection from '../../../components/forms/AddableSection'

export function ExperienceTab({ items = [], onAdd, onEdit, onRemove }) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'title',    label: t('addFields.functionTitle') },
    { key: 'company',  label: t('addFields.company') },
    { key: 'location', label: t('addFields.location') },
    { key: 'start',    label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true },
    { key: 'desc',     label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.experience')} emptyText={t('sections.experienceEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(e, i, arr) => (
        <div key={e.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title ?? e.function_title}</div>
            {(e.company ?? e.employer) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.company ?? e.employer}</div>}
            {e.location && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.location}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.period ?? [e.start_date, e.end_date].filter(Boolean).join(' – ')}</div>
          </div>
        </div>
      )} />
  )
}

export function EducationTab({ items = [], onAdd, onEdit, onRemove }) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'title',   label: t('addFields.diploma') },
    { key: 'school',  label: t('addFields.institution') },
    { key: 'start',   label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',     label: t('addFields.endDate'),   half: true, date: true },
    { key: 'desc',    label: t('addFields.description'), textarea: true },
    { key: 'issued',  label: t('addFields.issueDate'), date: true },
  ]
  return (
    <AddableSection title={t('sections.education')} emptyText={t('sections.educationEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(o, i, arr) => (
        <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.school ?? o.institution}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.period ?? o.year}</div>
          </div>
        </div>
      )} />
  )
}

export function LanguageTab({ items = [], onAdd, onEdit, onRemove }) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'language',        label: t('addFields.language') },
    { key: 'spoken',   label: t('addFields.spokenLevel') },
    { key: 'written',label: t('addFields.writtenLevel') },
  ]
  return (
    <AddableSection title={t('sections.languages')} emptyText={t('sections.languagesEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove} layout="tags"
      renderItem={(t0, i) => (
        <span key={t0.id ?? i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99,
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
          {t0.language ?? t0.language}{t0.spoken ? ` · ${t0.spoken}` : ''}{t0.written ? ` · ${t0.written}` : ''}
        </span>
      )} />
  )
}

export function CertificationsTab({ items = [], onAdd, onEdit, onRemove }) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'name',    label: t('addFields.certName') },
    { key: 'org',     label: t('addFields.organisation') },
    { key: 'issued',  label: t('addFields.issueDate'), separator: true, date: true },
    { key: 'expires', label: t('addFields.expiryDate'), date: true },
    { key: 'license', label: t('addFields.licenseNumber') },
    { key: 'desc',    label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.certifications')} emptyText={t('sections.certificationsEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(cert, i, arr) => (
        <div key={cert.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cert.name ?? cert.title}</div>
            {cert.org && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cert.org}</div>}
            {(cert.issued || cert.expires) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cert.issued && `${t('certified.issued')}: ${cert.issued}`}{cert.issued && cert.expires && ' · '}{cert.expires && `${t('certified.expires')}: ${cert.expires}`}
              </div>
            )}
          </div>
        </div>
      )} />
  )
}

export function SkillsTab({ items = [], onAdd, onEdit, onRemove }) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'name',  label: t('addFields.skill') },
    { key: 'level', label: t('addFields.skillLevel') },
  ]
  return (
    <AddableSection title={t('sections.skills')} emptyText={t('sections.skillsEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove} layout="tags"
      renderItem={(v, i) => (
        <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99,
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
          {typeof v === 'string' ? v : (v.name ?? v.skill)}
        </span>
      )} />
  )
}
