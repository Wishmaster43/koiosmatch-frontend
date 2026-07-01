/**
 * SectionTabs — the candidate's list sections (experience, education,
 * certifications, skills). Each is a thin config on the shared AddableSection.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import AddableSectionJs from '@/components/forms/AddableSection'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

// Relation items vary by backend version — kept loose at the prop boundary and
// cast to the concrete per-row shape inside each renderItem.
type RelItem = Record<string, unknown>
interface RelTabProps {
  items?: RelItem[]
  onAdd?: (v: RelItem) => void
  onEdit?: (i: number, v: RelItem) => void
  onRemove?: (i: number) => void
}
type AnyProps = Record<string, unknown>
const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

export function ExperienceTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Format a date to DD-MM-YYYY, or '' when empty (so ranges don't show a stray dash).
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: title+company and start+end each pair onto one row.
  const fields = [
    { key: 'title',    label: t('addFields.functionTitle'), half: true },
    { key: 'company',  label: t('addFields.company'),        half: true },
    { key: 'location', label: t('addFields.location') },
    { key: 'start',    label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true },
    { key: 'current',  label: t('addFields.currentJob'), checkbox: true },
    { key: 'desc',     label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.experience')} emptyText={t('sections.experienceEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const e = raw as { id?: Id; title?: string; function_title?: string; company?: string; employer?: string; location?: string; start?: string; start_date?: string; end?: string; end_date?: string; current?: boolean; period?: string }
        const start = e.start ?? e.start_date, end = e.end ?? e.end_date
        // Date range in DD-MM-YYYY; an open (current) job shows "– Heden".
        const range = e.current
          ? `${fmt(start)} – ${t('addFields.present')}`
          : (e.period ?? [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        return (
          <div key={e.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title ?? e.function_title}</div>
              {(e.company ?? e.employer) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.company ?? e.employer}</div>}
              {e.location && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.location}</div>}
              {range && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{range}</div>}
            </div>
          </div>
        )
      }} />
  )
}

export function EducationTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: diploma+school and start+end each pair; textarea goes last.
  const fields = [
    { key: 'title',     label: t('addFields.diploma'),     half: true },
    { key: 'school',    label: t('addFields.institution'), half: true },
    { key: 'start',     label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',       label: t('addFields.endDate'),   half: true, date: true,
      altLabel: t('addFields.expectedEnd'), altLabelWhen: 'inProgress' },
    { key: 'inProgress', label: t('addFields.inProgress'), checkbox: true },
    { key: 'issued',    label: t('addFields.issueDate'), date: true },
    { key: 'desc',      label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.education')} emptyText={t('sections.educationEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const o = raw as { id?: Id; title?: string; education?: string; school?: string; institution?: string; start?: string; start_date?: string; end?: string; end_date?: string; inProgress?: boolean; in_progress?: boolean; issued?: string; issue_date?: string; period?: string; year?: string }
        const start = o.start ?? o.start_date, end = o.end ?? o.end_date
        const inProgress = o.inProgress ?? o.in_progress
        // "Nog in opleiding" shows "– Heden"; otherwise the start–end range (DD-MM-YYYY).
        const range = o.period ?? (inProgress
          ? `${fmt(start)} – ${t('addFields.present')}`
          : [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        const issued = fmt(o.issued ?? o.issue_date)
        return (
          <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
              {(o.school ?? o.institution) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.school ?? o.institution}</div>}
              {range && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{range}</div>}
              {issued && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('addFields.issueDate')}: {issued}</div>}
            </div>
          </div>
        )
      }} />
  )
}

export function CertificationsTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: name+org pair; issued–expires stay a "tot" pair (separator).
  const fields = [
    { key: 'name',    label: t('addFields.certName'),     half: true },
    { key: 'org',     label: t('addFields.organisation'), half: true },
    { key: 'issued',  label: t('addFields.issueDate'), separator: true, date: true },
    { key: 'expires', label: t('addFields.expiryDate'), date: true },
    { key: 'license', label: t('addFields.licenseNumber') },
    { key: 'desc',    label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.certifications')} emptyText={t('sections.certificationsEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const cert = raw as { id?: Id; name?: string; title?: string; org?: string; issued?: string; expires?: string }
        return (
          <div key={cert.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cert.name ?? cert.title}</div>
              {cert.org && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cert.org}</div>}
              {(cert.issued || cert.expires) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {cert.issued && `${t('certified.issued')}: ${fmt(cert.issued)}`}{cert.issued && cert.expires && ' · '}{cert.expires && `${t('certified.expires')}: ${fmt(cert.expires)}`}
                </div>
              )}
            </div>
          </div>
        )
      }} />
  )
}

export function SkillsTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const fields = [
    { key: 'name',  label: t('addFields.skill') },
    { key: 'level', label: t('addFields.skillLevel') },
  ]
  // Skills render as a vertical list (one per row) so edit/remove read clearly.
  return (
    <AddableSection title={t('sections.skills')} emptyText={t('sections.skillsEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const v = raw as { id?: Id; name?: string; skill?: string; level?: string }
        const name  = typeof raw === 'string' ? raw : (v.name ?? v.skill ?? '')
        const level = typeof raw === 'string' ? '' : (v.level ?? '')
        return (
          <div key={v.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', paddingRight: 56,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
            {level && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {level}</span>}
          </div>
        )
      }} />
  )
}
