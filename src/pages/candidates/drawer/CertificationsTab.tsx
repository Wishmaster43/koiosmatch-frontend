/**
 * CertificationsTab — certifications list tab: add/edit/remove/reorder rows,
 * each optionally previewing an already-linked proof document via the shared
 * DocPreviewModal. Split out of the former SectionTabs.tsx verbatim (§3 size
 * discipline) — no behaviour change, only file boundaries.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRelationSort } from '@/components/forms/useRelationSort'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { useDateFormat } from '@/lib/datetime'
// DOC-1-EIGENAAR-1: the one shared "which document is still free" rule (measured 08-08).
import { linkedDocumentOptions } from './documentLinkRules'
// HUISSTIJL-1: the shared 13/600 title atom + the JetBrains Mono atom (identity-only swaps).
import { captionStyle,SectionTitle, Mono } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import {
  AddableSection, DocEntryLinks, ProseField, renderAddButton, resolveLinkedDocument,
} from './sectionTabsShared'
import type { RelItem, RelTabProps } from './sectionTabsShared'

// Certifications list tab: add/edit/remove/reorder rows, each optionally previewing an already-linked proof document via the shared DocPreviewModal.
export function CertificationsTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments, onReorder }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // DOC-GELDIGHEID-1: preview overlay for a row's linked proof document — the
  // shared house DocPreviewModal (never a fork).
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  // "Koppelen aan" picker options, resolved PER ROW — only documents no other entry
  // has claimed, plus this row's own pick (DOC-1-EIGENAAR-1).
  const documentOptions = linkedDocumentOptions(documents, items)
  // Compact layout: name+org pair; issued–expires stay a "tot" pair (separator).
  // The description renders as a `richtext` field in this same form (one
  // pencil per entry, Danny 05-08) — see ProseField (view-only) below.
  const fields = [
    // KAND-ACHTERGROND-VERPLICHT-1: `name` is required on create
    // (CandidateCertificationController::rules, measured 2026-08-17).
    { key: 'name',    label: t('addFields.certName'),     half: true, required: true },
    { key: 'org',     label: t('addFields.organisation'), half: true },
    { key: 'issued',  label: t('addFields.issueDate'), separator: true, date: true },
    { key: 'expires', label: t('addFields.expiryDate'), date: true, disabledWhen: 'noExpiry' },
    { key: 'noExpiry', label: t('addFields.alwaysValid'), checkbox: true },
    { key: 'license', label: t('addFields.licenseNumber') },
    // DOC-GELDIGHEID-1: optionally link an already-uploaded proof document to this entry
    // (only offered once the candidate HAS documents — §3, no fake affordance).
    ...(documents.length > 0 ? [{ key: 'document_id', label: t('addFields.linkedDocument'), options: documentOptions }] : []),
    { key: 'desc',    label: t('addFields.description'), richtext: true },
  ]
  // Sub-tab sort notes: candidate_certifications has no columns literally named
  // start_date/end_date, but issue_date/expiration_date serve the exact same
  // "opens/closes the validity window" role — offered under the same
  // startDate/endDate axis, labelled with THIS tab's own field names
  // (Issued/Expires, t('certified.*')) so nothing is mislabeled. No function
  // field exists here, so it is omitted (Requirement 2). DRAG-SORT-1:
  // candidate_certifications carries sort_order + PUT .../reorder, so 'own' is
  // offered too.
  const { order, control, isOwnOrder } = useRelationSort(items, {
    storageKey: 'certifications',
    startDateOf: (raw: RelItem) => (raw.issued ?? raw.issue_date) as string | undefined,
    startDateLabel: t('certified.issued'),
    endDateOf: (raw: RelItem) => (raw.expires ?? raw.expiry_date ?? raw.expiration_date) as string | undefined,
    endDateLabel: t('certified.expires'),
    ownOrder: true,
  })
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.certificationsEmpty')} renderAddButton={renderAddButton} order={order} headerExtra={control}
      dragEnabled={isOwnOrder} onReorder={onReorder}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      editInitial={(it: RelItem) => ({ ...it, noExpiry: !(it as { expires?: unknown }).expires })}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const cert = raw as { id?: Id; name?: string; title?: string; org?: string; issued?: string; expires?: string; license?: string; desc?: string }
        // One compact secondary line (organisation · issued–expires) — mirrors
        // Experience/Education; organisation no longer wraps onto its own line (C-13a).
        const dateRange = [cert.issued && `${t('certified.issued')}: ${fmt(cert.issued)}`, cert.expires && `${t('certified.expires')}: ${fmt(cert.expires)}`].filter(Boolean).join(' · ')
        const secondary = [cert.org, dateRange].filter(Boolean).join(' · ')
        // DOC-GELDIGHEID-1: resolve the linked proof document, if any — icons render only when found.
        const linkedDoc = resolveLinkedDocument(raw, documents, 'certification_id')
        return (
          <div key={cert.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-violet)', flexShrink: 0, marginTop: 4 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* HUISSTIJL-1: identical 13/600/var(--text) render as a div; the
                  truncation props ride through the atom's style prop unchanged. */}
              <SectionTitle as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.name ?? cert.title}</SectionTitle>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              {/* Licence number (C-13b) — a code/ID, so JetBrains Mono per §4.
                  HUISSTIJL-1: identical fontFamily/size/colour render as a div. */}
              {/* Mono family + caption identity via the raw style object (stijlfabriek pattern). */}
              {cert.license && <Mono as="div" style={captionStyle}>{t('addFields.licenseNumber')}: {cert.license}</Mono>}
              <ProseField value={cert.desc} />
              {linkedDoc && <DocEntryLinks doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
            </div>
          </div>
        )
      }} />
    {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
