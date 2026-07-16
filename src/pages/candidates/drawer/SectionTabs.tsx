/**
 * SectionTabs — the candidate's list sections (experience, education,
 * certifications, skills). Each is a thin config on the shared AddableSection.
 */
import { useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import AddableSectionJs from '@/components/forms/AddableSection'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
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

// Resolves the education "start" date for BOTH the read line and the edit form:
// the real start date first, else — only for an in-progress row — the issue/diploma
// date stands in (legacy rows that recorded a diploma date but never a start date,
// see the range fallback in EducationTab below). Exported so the edit-form
// prefill (editInitial) and the read display can never drift apart again (that
// drift was job C-12: read showed a start date the pencil opened empty).
export function resolveEducationStartDate(o: {
  start?: unknown; start_date?: unknown; issued?: unknown; issue_date?: unknown
  inProgress?: unknown; in_progress?: unknown
}): string | undefined {
  const start = (o.start ?? o.start_date) as string | undefined
  if (start) return start
  const inProgress = Boolean(o.inProgress ?? o.in_progress)
  return inProgress ? ((o.issued ?? o.issue_date) as string | undefined) : undefined
}

/** One multi-line "prose" field with its OWN pencil → RichTextEditor → save/✕, exactly
 * mirroring the candidate profile text (house rule: every free-text field is a rich-text
 * block — ProfileTab.tsx's summary editor is the reference). Shared by the Experience and
 * Certifications rows so their description never regresses to a bare textarea again. */
function ProseField({ value, onSave }: { value?: string; onSave: (html: string) => void }) {
  const { t } = useTranslation('common')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const iconBtn: CSSProperties = { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }
  const start  = () => { setDraft(value ?? ''); setEditing(true) }
  const save   = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(value ?? ''); setEditing(false) }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing
          ? <RichTextEditor value={draft} onChange={setDraft} />
          : (value
              ? <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }} />
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>)}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {editing ? (
          <>
            {/* data-testid: disambiguates this pencil from the row-level one in tests (both share the 'Bewerken' title). */}
            <button onClick={save} title={t('save')} data-testid="prose-save" style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={12} /></button>
            <button onClick={cancel} title={t('cancel')} data-testid="prose-cancel" style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={12} /></button>
          </>
        ) : (
          <button onClick={start} title={t('edit')} data-testid="prose-edit" style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={12} /></button>
        )}
      </div>
    </div>
  )
}

export function ExperienceTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Format a date to DD-MM-YYYY, or '' when empty (so ranges don't show a stray dash).
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: title+company and start+end each pair onto one row. The
  // description is NOT a plain-form field anymore — it gets its own rich-text
  // pencil below (ProseField), mirroring the candidate profile text.
  const fields = [
    { key: 'title',    label: t('addFields.functionTitle'), half: true },
    { key: 'company',  label: t('addFields.company'),        half: true },
    { key: 'location', label: t('addFields.location') },
    { key: 'start',    label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true, disabledWhen: 'current' },
    { key: 'current',  label: t('addFields.currentJob'), checkbox: true },
  ]
  return (
    <AddableSection title={t('sections.experience')} emptyText={t('sections.experienceEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const e = raw as { id?: Id; title?: string; function_title?: string; company?: string; employer?: string; location?: string; start?: string; start_date?: string; end?: string; end_date?: string; current?: boolean; period?: string; desc?: string }
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title ?? e.function_title}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              <ProseField value={e.desc} onSave={html => onEdit?.(i, { desc: html })} />
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
    // Description is NOT a plain-form field — it gets its own rich-text pencil
    // below (ProseField), mirroring Experience/Certifications (house rule).
  ]
  return (
    <AddableSection title={t('sections.education')} emptyText={t('sections.educationEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      // Mirror the read line's own fallback (resolveEducationStartDate) into the edit
      // form's initial values — otherwise a legacy in-progress row that shows e.g.
      // "01-01-2009 – heden" on the read line opens the pencil with an EMPTY start
      // date (C-12): the read view fell back to the diploma date, the form didn't.
      editInitial={(it: RelItem) => ({ ...it, inProgress: Boolean((it as { inProgress?: unknown; in_progress?: unknown }).inProgress ?? (it as { in_progress?: unknown }).in_progress), start: resolveEducationStartDate(it) })}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const o = raw as { id?: Id; title?: string; education?: string; school?: string; institution?: string; start?: string; start_date?: string; end?: string; end_date?: string; inProgress?: boolean; in_progress?: boolean; issued?: string; issue_date?: string; period?: string; year?: string }
        const start = o.start ?? o.start_date, end = o.end ?? o.end_date
        const inProgress = o.inProgress ?? o.in_progress
        // In progress: "start – heden" (issue date doubles as start on old rows;
        // Danny 14/7), else "Nog in opleiding" — never a dangling dash. Done:
        // the start–end range (DD-MM-YYYY).
        const startish = fmt(resolveEducationStartDate(o))
        const range = o.period ?? (inProgress
          ? (startish ? `${startish} – ${t('addFields.present')}` : t('addFields.inProgress'))
          : [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        // An in-progress opleiding has no diploma yet — suppress the issue date.
        const issued = inProgress ? '' : fmt(o.issued ?? o.issue_date)
        // Compact secondary line: school · period · issue-date on one muted row (like Experience).
        const secondary = [o.school ?? o.institution, range, issued ? `${t('addFields.issueDate')}: ${issued}` : null].filter(Boolean).join(' · ')
        return (
          <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              <ProseField value={(o as { desc?: string }).desc} onSave={html => onEdit?.(i, { desc: html })} />
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
  // The description is NOT a plain-form field anymore — see ProseField below.
  const fields = [
    { key: 'name',    label: t('addFields.certName'),     half: true },
    { key: 'org',     label: t('addFields.organisation'), half: true },
    { key: 'issued',  label: t('addFields.issueDate'), separator: true, date: true },
    { key: 'expires', label: t('addFields.expiryDate'), date: true, disabledWhen: 'noExpiry' },
    { key: 'noExpiry', label: t('addFields.alwaysValid'), checkbox: true },
    { key: 'license', label: t('addFields.licenseNumber') },
  ]
  return (
    <AddableSection title={t('sections.certifications')} emptyText={t('sections.certificationsEmpty')}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      editInitial={(it: RelItem) => ({ ...it, noExpiry: !(it as { expires?: unknown }).expires })}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const cert = raw as { id?: Id; name?: string; title?: string; org?: string; issued?: string; expires?: string; license?: string; desc?: string }
        // One compact secondary line (organisation · issued–expires) — mirrors
        // Experience/Education; organisation no longer wraps onto its own line (C-13a).
        const dateRange = [cert.issued && `${t('certified.issued')}: ${fmt(cert.issued)}`, cert.expires && `${t('certified.expires')}: ${fmt(cert.expires)}`].filter(Boolean).join(' · ')
        const secondary = [cert.org, dateRange].filter(Boolean).join(' · ')
        return (
          <div key={cert.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.name ?? cert.title}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              {/* Licence number (C-13b) — a code/ID, so JetBrains Mono per §4. */}
              {cert.license && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{t('addFields.licenseNumber')}: {cert.license}</div>}
              <ProseField value={cert.desc} onSave={html => onEdit?.(i, { desc: html })} />
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
