/**
 * sectionTabsShared — the pieces shared by every Achtergrond list tab
 * (ExperienceTab/EducationTab/CertificationsTab/SkillsTab): the shared prop
 * shapes, the "+ Toevoegen" render-prop, the linked-document resolver + its
 * icon row, the education start-date fallback, and the read-only prose line.
 * Split out of the former SectionTabs.tsx verbatim (§3 size discipline) — no
 * behaviour change, only file boundaries.
 */
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { Eye, Download, ArrowRight } from 'lucide-react'
import AddableSectionJs from '@/components/forms/AddableSection'
import SafeHtml from '@/components/ui/SafeHtml'
import DrawerAddButton from './DrawerAddButton'
import { downloadFilesSequentially } from '@/lib/downloadFiles'

// One shared render-prop: the "+ Toevoegen" trigger for every Achtergrond
// sub-tab, styled like the WorkTab "+ Match" reference (2026-07 sweep) instead
// of AddableSection's plain left-aligned link. Short text (DRAWER-ADD-SHORT-1,
// Danny 05-08): every caller below renders inside its own Achtergrond sub-tab,
// never a full page.
export const renderAddButton = (onClick: () => void) => <DrawerAddButton onClick={onClick} short />

// Relation items vary by backend version — kept loose at the prop boundary and
// cast to the concrete per-row shape inside each renderItem.
export type RelItem = Record<string, unknown>
export interface RelTabProps {
  items?: RelItem[]
  onAdd?: (v: RelItem) => void
  onEdit?: (i: number, v: RelItem) => void
  onRemove?: (i: number) => void
  // DOC-ENTRY-LINK-1 (education/certification ↔ document): the candidate's own
  // documents (for the "Koppelen aan" edit-form picker + icon resolution) and a
  // callback that switches the drawer to the Documenten tab (Education/
  // Certifications only — Experience/Skills ignore both, harmlessly unused).
  documents?: RelItem[]
  onJumpToDocuments?: () => void
  // DRAG-SORT-1: fires with the FULL item list in its new order once a manual
  // reorder (drag or keyboard move-up/down) completes — only reachable while the
  // sort menu's "own order" axis is active (useRelationSort's `isOwnOrder`).
  // BackgroundTab owns the real optimistic PUT .../reorder + revert.
  onReorder?: (items: RelItem[]) => void
}
export type AnyProps = Record<string, unknown>
export const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

/**
 * DOC-ENTRY-LINK-1 (CMFE): resolve the proof document (if any) linked to an
 * education/certification/language/skill entry. DOC-EDU-1/DOC-GELDIGHEID-1/
 * DOC-LANG-SKILL-LINK-1 all PATCH a plain `document_id` onto the entry —
 * resolved here by cross-referencing the candidate's already-loaded documents
 * list first (the authoritative, fully normalised source: url/download_url/
 * name/type all come from mapCandidate). The education/language/skill
 * resources additionally NEST the full document object (no second fetch
 * needed), and a document also carries the reverse link (education_id/
 * certification_id/language_id/skill_id) — both are tried as fallbacks so
 * whichever shape a given payload actually carries still resolves to the
 * same document.
 */
export function resolveLinkedDocument(
  entry: RelItem,
  documents: RelItem[],
  // DOC-ERV-1: 'experience_id' added — a work-experience row can carry the same
  // proof-document link (document_id / nested document / reverse FK) as the
  // other relations; read-only here (no "Koppelen aan" picker on this tab).
  reverseKey: 'education_id' | 'certification_id' | 'language_id' | 'skill_id' | 'experience_id',
): RelItem | undefined {
  const docId = entry.document_id
  if (docId != null) {
    const byId = documents.find(d => String(d.id) === String(docId))
    if (byId) return byId
  }
  const nested = entry.document
  if (nested && typeof nested === 'object') return nested as RelItem
  return documents.find(d => d[reverseKey] != null && String(d[reverseKey]) === String(entry.id))
}

/**
 * Three subtle icon-buttons for an entry's linked proof document — same muted
 * style as AddableSection's own pencil/trash controls (§3A: reuse, never
 * duplicate). Only ever mounted once a linked document was resolved (calm by
 * default — no icons, no link).
 */
export function DocEntryLinks({ doc, onPreview, onJump }: { doc: RelItem; onPreview: () => void; onJump?: () => void }) {
  const { t } = useTranslation('candidates')
  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' } as const
  // Same download mechanics as DocumentsSection's own row action (one shared helper).
  const download = () => { downloadFilesSequentially([{ url: (doc.url as string) ?? (doc.download_url as string), name: (doc.name as string) ?? '' }]) }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 }}>
      <button type="button" aria-label={t('documents.preview')} title={t('documents.preview')} onClick={onPreview} style={iconBtn}><Eye size={12} /></button>
      <button type="button" aria-label={t('documents.download')} title={t('documents.download')} onClick={download} style={iconBtn}><Download size={12} /></button>
      {onJump && (
        <button type="button" aria-label={t('documents.jumpToDocuments')} title={t('documents.jumpToDocuments')} onClick={onJump} style={iconBtn}><ArrowRight size={12} /></button>
      )}
    </div>
  )
}

// Resolves the education "start" date for BOTH the read line and the edit form:
// the real start date first, else — only for an in-progress row — the issue/diploma
// date stands in (legacy rows that recorded a diploma date but never a start date,
// see the range fallback in EducationTab). Exported so the edit-form
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

/** Read-only "prose" line for a row's description — renders the saved HTML via
 * SafeHtml (house rule: every free-text field is a rich-text block), or the "-"
 * empty placeholder. VIEW ONLY (Danny 05-08, DRAWER-ONE-PENCIL-1): this used to
 * carry its OWN pencil → RichTextEditor → save/✕, so an entry showed TWO edit
 * affordances (this one + the row-level pencil). Editing moved into the row's
 * own edit form — the `desc` field now renders there via the shared
 * `richtext: true` field type (AddForm.tsx) — so one pencil owns the whole row. */
export function ProseField({ value }: { value?: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      {value
        ? <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }} />
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
    </div>
  )
}
