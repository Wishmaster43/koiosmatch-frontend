/**
 * EducationTab — education list tab: add/edit/remove/reorder rows, each
 * optionally previewing an already-linked proof document via the shared
 * DocPreviewModal. Split out of the former SectionTabs.tsx verbatim (§3 size
 * discipline) — no behaviour change, only file boundaries.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRelationSort } from '@/components/forms/useRelationSort'
import SoftChip from '@/components/ui/SoftChip'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import LookupIcon from '@/components/ui/LookupIcon'
import { useDateFormat } from '@/lib/datetime'
import { useEducationLevels } from '@/lib/useEducationLevels'
// DOC-1-EIGENAAR-1: the one shared "which document is still free" rule (measured 08-08).
import { linkedDocumentOptions } from './documentLinkRules'
// HUISSTIJL-1: the shared 13/600 title atom.
import { SectionTitle } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import {
  AddableSection, DocEntryLinks, ProseField, renderAddButton, resolveEducationStartDate, resolveLinkedDocument,
} from './sectionTabsShared'
import type { RelItem, RelTabProps } from './sectionTabsShared'

// Education list tab: add/edit/remove/reorder rows, each optionally previewing an already-linked proof document via the shared DocPreviewModal.
export function EducationTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments, onReorder }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // DOC-EDU-1: preview overlay for a row's linked proof document — the shared
  // house DocPreviewModal (never a fork).
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  // "Koppelen aan" picker options, resolved PER ROW — only documents no other entry
  // has claimed, plus this row's own pick (DOC-1-EIGENAAR-1).
  const documentOptions = linkedDocumentOptions(documents, items)
  // KAND-NIVEAU-1: the tenant education-level lookup (id-based — level_id on
  // candidate_educations, never the name, so a tenant rename never breaks a row).
  const { levels } = useEducationLevels()
  const levelOptions = levels.map(l => ({ value: l.id, label: l.label }))
  // Compact layout: diploma+school and start+end each pair; description (richtext) goes last.
  const fields = [
    // KAND-ACHTERGROND-VERPLICHT-1: `title` is required on create
    // (CandidateEducationController::rules, measured 2026-08-17).
    { key: 'title',     label: t('addFields.diploma'),     half: true, required: true },
    { key: 'school',    label: t('addFields.institution'), half: true },
    // KAND-NIVEAU-1: a pick-only dropdown (own row, full width) — AddForm's `options`
    // field now renders the house CreatableSelect (ALWAYS-SEARCHABLE-1, Danny 08-08,
    // AddForm.tsx), never a native <select>. `defaultValue` stays as a harmless belt-
    // and-braces fallback (the key already exists in every locale).
    { key: 'level_id',  label: t('addFields.educationLevel', { defaultValue: 'Niveau' }), options: levelOptions },
    { key: 'start',     label: t('addFields.startDate'), half: true, date: true },
    { key: 'end',       label: t('addFields.endDate'),   half: true, date: true,
      altLabel: t('addFields.expectedEnd'), altLabelWhen: 'inProgress' },
    { key: 'inProgress', label: t('addFields.inProgress'), checkbox: true },
    { key: 'issued',    label: t('addFields.diplomaDate'), date: true, hideWhen: 'inProgress' },
    // DOC-EDU-1: optionally link an already-uploaded proof document to this entry.
    // Offered only once the candidate HAS documents — an always-empty dropdown is a
    // fake affordance (§3).
    ...(documents.length > 0 ? [{ key: 'document_id', label: t('addFields.linkedDocument'), options: documentOptions }] : []),
    // Description renders as a `richtext` field in this same form, mirroring
    // Experience/Certifications — one pencil per entry (Danny 05-08).
    { key: 'desc',      label: t('addFields.description'), richtext: true },
  ]
  // Sub-tab sort notes: candidate_educations has real start_date + end_date
  // columns (start falls back to the diploma/issue date for an in-progress row,
  // mirroring resolveEducationStartDate's own read-line fallback) — offer both.
  // No job-title/function field exists on this table, so 'function' is omitted
  // entirely (Requirement 2: never offer an option with nothing to sort by).
  // DRAG-SORT-1: candidate_educations carries sort_order + PUT .../reorder, so
  // 'own' is offered too.
  const { order, control, isOwnOrder } = useRelationSort(items, {
    storageKey: 'education',
    startDateOf: (raw: RelItem) => resolveEducationStartDate(raw as { start?: unknown; start_date?: unknown; issued?: unknown; issue_date?: unknown }),
    endDateOf:   (raw: RelItem) => (raw.end ?? raw.end_date) as string | undefined,
    ownOrder: true,
  })
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.educationEmpty')} renderAddButton={renderAddButton} order={order} headerExtra={control}
      dragEnabled={isOwnOrder} onReorder={onReorder}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      // Mirror the read line's own fallback (resolveEducationStartDate) into the edit
      // form's initial values — otherwise a legacy in-progress row that shows e.g.
      // "01-01-2009 – heden" on the read line opens the pencil with an EMPTY start
      // date (C-12): the read view fell back to the diploma date, the form didn't.
      editInitial={(it: RelItem) => ({ ...it, inProgress: Boolean((it as { inProgress?: unknown; in_progress?: unknown }).inProgress ?? (it as { in_progress?: unknown }).in_progress), start: resolveEducationStartDate(it) })}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const o = raw as { id?: Id; title?: string; education?: string; school?: string; institution?: string; start?: string; start_date?: string; end?: string; end_date?: string; inProgress?: boolean; in_progress?: boolean; issued?: string; issue_date?: string; period?: string; year?: string; level_id?: string; level?: { id?: string; name?: string; color?: string; icon?: string | null } }
        const start = o.start ?? o.start_date, end = o.end ?? o.end_date
        // KAND-NIVEAU-1: the nested {id,name,color,icon} the API returns wins (no extra
        // lookup); a row just added/edited in THIS session (before the server echoes
        // it back) falls back to resolving the picked id against the loaded lookup.
        const localLevel = o.level_id ? levels.find(l => l.id === o.level_id) : undefined
        const levelName = o.level?.name ?? localLevel?.label
        const levelColor = o.level?.color ?? localLevel?.color
        // LOOKUP-ICON-1: education-level icon (lucide slug or emoji), shown next to
        // the label — never instead of it (§6, colour/icon is never the only signal).
        const levelIcon = o.level?.icon ?? localLevel?.icon
        const inProgress = o.inProgress ?? o.in_progress
        // In progress: "start – heden" (issue date doubles as start on old rows;
        // Danny 14/7), else "Nog in opleiding" — never a dangling dash. Done:
        // the start–end range (DD-MM-YYYY).
        const startish = fmt(resolveEducationStartDate(o))
        // Wording matches the checkbox ("Nog in opleiding") — it said "heden",
        // which is the EXPERIENCE wording for a current job (Danny punt 11, 16-07).
        const range = o.period ?? (inProgress
          ? (startish ? `${startish} – ${t('addFields.inProgress').toLowerCase()}` : t('addFields.inProgress'))
          : [fmt(start), fmt(end)].filter(Boolean).join(' – '))
        // An in-progress opleiding has no diploma yet — suppress the issue date.
        const issued = inProgress ? '' : fmt(o.issued ?? o.issue_date)
        // Compact secondary line: school · period · issue-date on one muted row (like Experience).
        const secondary = [o.school ?? o.institution, range, issued ? `${t('addFields.issueDate')}: ${issued}` : null].filter(Boolean).join(' · ')
        // DOC-EDU-1: resolve the linked proof document, if any — icons render only when found.
        const linkedDoc = resolveLinkedDocument(raw, documents, 'education_id')
        return (
          <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* HUISSTIJL-1: identical 13/600/var(--text) render as a div. */}
                <SectionTitle as="div">{o.title ?? o.education}</SectionTitle>
                {/* KAND-NIVEAU-1: the picked education level as a soft chip (§4 convention).
                    LOOKUP-ICON-1: the tenant icon rides inside the chip label, next to
                    the text — icon is additive, never the only signal. */}
                {levelName && (
                  <SoftChip color={levelColor} label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {levelIcon && <LookupIcon icon={levelIcon} size={11} color={levelColor} />}
                      {levelName}
                    </span>
                  } />
                )}
              </div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              <ProseField value={(o as { desc?: string }).desc} />
              {linkedDoc && <DocEntryLinks doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
            </div>
          </div>
        )
      }} />
    {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
