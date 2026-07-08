/**
 * SectionTabs — the candidate's list sections (experience, education,
 * certifications, skills). Each is a thin config on the shared AddableSection.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import AddableSectionJs from '@/components/forms/AddableSection'
import { useDateFormat } from '@/lib/datetime'
import { useSkillLevels } from '@/lib/useSkillLevels'
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
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true, disabledWhen: 'current' },
    { key: 'current',  label: t('addFields.currentJob'), checkbox: true },
    { key: 'desc',     label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.experience')} emptyText={t('sections.experienceEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const e = raw as { id?: Id; title?: string; function_title?: string; company?: string; employer?: string; location?: string; start?: string; start_date?: string; end?: string; end_date?: string; current?: boolean; period?: string }
        const start = e.start ?? e.start_date, end = e.end ?? e.end_date
        // Date range in DD-MM-YYYY; an open (current) job shows "– Heden" — but only
        // with a start date, so an unknown start never renders a dangling "– Heden".
        const range = e.current
          ? (fmt(start) ? `${fmt(start)} – ${t('addFields.present')}` : t('addFields.present'))
          : (e.period ?? [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        // Compact secondary line: employer · location · period on one muted row (strak, like Education).
        const secondary = [e.company ?? e.employer, e.location, range].filter(Boolean).join(' · ')
        return (
          <div key={e.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title ?? e.function_title}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
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
    { key: 'issued',    label: t('addFields.diplomaDate'), date: true, hideWhen: 'inProgress' },
    { key: 'desc',      label: t('addFields.description'), textarea: true },
  ]
  return (
    <AddableSection title={t('sections.education')} emptyText={t('sections.educationEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const o = raw as { id?: Id; title?: string; education?: string; school?: string; institution?: string; start?: string; start_date?: string; end?: string; end_date?: string; inProgress?: boolean; in_progress?: boolean; issued?: string; issue_date?: string; period?: string; year?: string }
        const start = o.start ?? o.start_date, end = o.end ?? o.end_date
        const inProgress = o.inProgress ?? o.in_progress
        // In progress: "start – Heden" with a start, else just "Nog in opleiding"
        // (no dangling dash); otherwise the start–end range (DD-MM-YYYY).
        const range = o.period ?? (inProgress
          ? (fmt(start) ? `${fmt(start)} – ${t('addFields.present')}` : t('addFields.inProgress'))
          : [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        const issued = fmt(o.issued ?? o.issue_date)
        // Compact secondary line: school · period · issue-date on one muted row (like Experience).
        const secondary = [o.school ?? o.institution, range, issued ? `${t('addFields.issueDate')}: ${issued}` : null].filter(Boolean).join(' · ')
        return (
          <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
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
    { key: 'expires', label: t('addFields.expiryDate'), date: true, disabledWhen: 'noExpiry' },
    { key: 'noExpiry', label: t('addFields.alwaysValid'), checkbox: true },
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
  // Level is a tenant lookup dropdown (SKILL-LVL-1), mirroring the languages editor.
  const { levels } = useSkillLevels()
  const fields = [
    { key: 'name',  label: t('addFields.skill') },
    { key: 'level', label: t('addFields.skillLevel'), options: levels },
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
