/**
 * ExperienceTab — work-experience list tab: add/edit/remove/reorder rows, each
 * optionally previewing an already-linked proof document via the shared
 * DocPreviewModal. Split out of the former SectionTabs.tsx verbatim (§3 size
 * discipline) — no behaviour change, only file boundaries.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRelationSort } from '@/components/forms/useRelationSort'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { useDateFormat } from '@/lib/datetime'
// HUISSTIJL-1: the shared 13/600 title atom.
import { SectionTitle } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import {
  AddableSection, DocEntryLinks, ProseField, renderAddButton, resolveLinkedDocument,
} from './sectionTabsShared'
import type { RelItem, RelTabProps } from './sectionTabsShared'

// Work-experience list tab: add/edit/remove/reorder rows, each optionally previewing an already-linked proof document via the shared DocPreviewModal.
export function ExperienceTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments, onReorder }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // DOC-ERV-1: preview overlay for a row's linked proof document — the shared
  // pattern already used by Education/Certifications/Skills below. No "Koppelen
  // aan" edit-form picker here (no persistence UI is being added) — this only
  // SURFACES a document_id/nested document the row already carries.
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  // Format a date to DD-MM-YYYY, or '' when empty (so ranges don't show a stray dash).
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: title+company and start+end each pair onto one row. The
  // description renders as a `richtext` field IN this same form (one pencil
  // per entry, Danny 05-08) — the row reads it back via ProseField (view-only).
  const fields = [
    { key: 'title',    label: t('addFields.functionTitle'), half: true },
    // KAND-ACHTERGROND-VERPLICHT-1: `company` is the FE name for the backend's
    // `employer` column, required on create (CandidateExperienceController::rules) —
    // measured 2026-08-17, this is the exact field behind Danny's "employer field
    // is required" toast.
    { key: 'company',  label: t('addFields.company'),        half: true, required: true },
    { key: 'location', label: t('addFields.location') },
    { key: 'start',    label: t('addFields.startDate'), half: true, date: true },
    // End date stays editable WITH 'current' checked (Danny 24-07: a known
    // upcoming end date on a current job must be enterable).
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true },
    { key: 'current',  label: t('addFields.currentJob'), checkbox: true },
    { key: 'desc',     label: t('addFields.description'), richtext: true },
  ]
  // Sub-tab sort notes (build brief Requirement 2/3): candidate_work_experiences
  // has real start_date + end_date columns, plus the job title — stored on the
  // BACKEND in a column literally named `position` (confirmed against the
  // migration, 2026-08-17). That `position` is a plain string field (the job
  // title), NOT the `sort_order` ordering column the 'own' axis below reads
  // (DRAG-SORT-1) — the two must never be confused. The FE local key for the
  // job title is `title`/`function_title` (TO_API maps it to `function_title`
  // above) — sort-by-function reads THAT. All three date/function axes are real
  // here, plus 'own' (the backend carries sort_order + PUT .../reorder for
  // candidate_work_experiences), so all four are offered.
  const { order, control, isOwnOrder } = useRelationSort(items, {
    storageKey: 'experience',
    startDateOf: (raw: RelItem) => (raw.start ?? raw.start_date) as string | undefined,
    endDateOf:   (raw: RelItem) => (raw.end ?? raw.end_date) as string | undefined,
    functionOf:  (raw: RelItem) => (raw.title ?? raw.function_title) as string | undefined,
    ownOrder: true,
  })
  return (
    <>
      <AddableSection title={null} emptyText={t('sections.experienceEmpty')} renderAddButton={renderAddButton} order={order} headerExtra={control}
        dragEnabled={isOwnOrder} onReorder={onReorder}
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
          // DOC-ERV-1: resolve the linked proof document, if any — icons render only when found.
          const linkedDoc = resolveLinkedDocument(raw, documents, 'experience_id')
          return (
            <div key={e.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* HUISSTIJL-1: identical 13/600/var(--text) render as a div. */}
                <SectionTitle as="div">{e.title ?? e.function_title}</SectionTitle>
                {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
                <ProseField value={e.desc} />
                {linkedDoc && <DocEntryLinks doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
              </div>
            </div>
          )
        }} />
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
