/**
 * SectionTabs — the candidate's list sections (experience, education,
 * certifications, skills). Each is a thin config on the shared AddableSection.
 *
 * `title={null}` on every AddableSection below (Danny addendum 4, kandidaten-
 * ronde-2): each of these now renders ONLY inside its own Achtergrond sub-tab
 * (Ervaring/Opleiding/Certificeringen/Vaardigheden — BackgroundTab.tsx), whose
 * sub-tab bar already carries that exact label — an in-content "CERTIFICERINGEN"
 * card title right under the "Certificeringen" sub-tab button was a double
 * heading. SectionCard (under AddableSection) skips the title row entirely when
 * `title` is falsy but still renders its `action` ("+ Toevoegen"), so the calm
 * content starts directly with the add-button row.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, ArrowRight } from 'lucide-react'
import AddableSectionJs from '@/components/forms/AddableSection'
import SafeHtml from '@/components/ui/SafeHtml'
import SoftChip from '@/components/ui/SoftChip'
import DrawerAddButton from './DrawerAddButton'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { useDateFormat } from '@/lib/datetime'
import { useSkillLevels } from '@/lib/useSkillLevels'
import { useEducationLevels } from '@/lib/useEducationLevels'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
// DOC-1-EIGENAAR-1: the one shared "which document is still free" rule (measured 08-08).
import { linkedDocumentOptions } from './documentLinkRules'
import type { Id } from '@/types/common'

// One shared render-prop: the "+ Toevoegen" trigger for every Achtergrond
// sub-tab, styled like the WorkTab "+ Match" reference (2026-07 sweep) instead
// of AddableSection's plain left-aligned link. Short text (DRAWER-ADD-SHORT-1,
// Danny 05-08): every caller below renders inside its own Achtergrond sub-tab,
// never a full page.
const renderAddButton = (onClick: () => void) => <DrawerAddButton onClick={onClick} short />

// Relation items vary by backend version — kept loose at the prop boundary and
// cast to the concrete per-row shape inside each renderItem.
type RelItem = Record<string, unknown>
interface RelTabProps {
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
}
type AnyProps = Record<string, unknown>
const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

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
  reverseKey: 'education_id' | 'certification_id' | 'language_id' | 'skill_id',
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
function DocEntryLinks({ doc, onPreview, onJump }: { doc: RelItem; onPreview: () => void; onJump?: () => void }) {
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

/** Read-only "prose" line for a row's description — renders the saved HTML via
 * SafeHtml (house rule: every free-text field is a rich-text block), or the "-"
 * empty placeholder. VIEW ONLY (Danny 05-08, DRAWER-ONE-PENCIL-1): this used to
 * carry its OWN pencil → RichTextEditor → save/✕, so an entry showed TWO edit
 * affordances (this one + the row-level pencil). Editing moved into the row's
 * own edit form — the `desc` field now renders there via the shared
 * `richtext: true` field type (AddForm.tsx) — so one pencil owns the whole row. */
function ProseField({ value }: { value?: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      {value
        ? <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }} />
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
    </div>
  )
}

export function ExperienceTab({ items = [], onAdd, onEdit, onRemove }: RelTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Format a date to DD-MM-YYYY, or '' when empty (so ranges don't show a stray dash).
  const fmt = (d?: string) => (d ? formatDate(d) : '')
  // Compact layout: title+company and start+end each pair onto one row. The
  // description renders as a `richtext` field IN this same form (one pencil
  // per entry, Danny 05-08) — the row reads it back via ProseField (view-only).
  const fields = [
    { key: 'title',    label: t('addFields.functionTitle'), half: true },
    { key: 'company',  label: t('addFields.company'),        half: true },
    { key: 'location', label: t('addFields.location') },
    { key: 'start',    label: t('addFields.startDate'), half: true, date: true },
    // End date stays editable WITH 'current' checked (Danny 24-07: a known
    // upcoming end date on a current job must be enterable).
    { key: 'end',      label: t('addFields.endDate'),   half: true, date: true },
    { key: 'current',  label: t('addFields.currentJob'), checkbox: true },
    { key: 'desc',     label: t('addFields.description'), richtext: true },
  ]
  return (
    <AddableSection title={null} emptyText={t('sections.experienceEmpty')} renderAddButton={renderAddButton}
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
              <ProseField value={e.desc} />
            </div>
          </div>
        )
      }} />
  )
}

export function EducationTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments }: RelTabProps) {
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
    { key: 'title',     label: t('addFields.diploma'),     half: true },
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
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.educationEmpty')} renderAddButton={renderAddButton}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      // Mirror the read line's own fallback (resolveEducationStartDate) into the edit
      // form's initial values — otherwise a legacy in-progress row that shows e.g.
      // "01-01-2009 – heden" on the read line opens the pencil with an EMPTY start
      // date (C-12): the read view fell back to the diploma date, the form didn't.
      editInitial={(it: RelItem) => ({ ...it, inProgress: Boolean((it as { inProgress?: unknown; in_progress?: unknown }).inProgress ?? (it as { in_progress?: unknown }).in_progress), start: resolveEducationStartDate(it) })}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const o = raw as { id?: Id; title?: string; education?: string; school?: string; institution?: string; start?: string; start_date?: string; end?: string; end_date?: string; inProgress?: boolean; in_progress?: boolean; issued?: string; issue_date?: string; period?: string; year?: string; level_id?: string; level?: { id?: string; name?: string; color?: string } }
        const start = o.start ?? o.start_date, end = o.end ?? o.end_date
        // KAND-NIVEAU-1: the nested {id,name,color} the API returns wins (no extra
        // lookup); a row just added/edited in THIS session (before the server echoes
        // it back) falls back to resolving the picked id against the loaded lookup.
        const localLevel = o.level_id ? levels.find(l => l.id === o.level_id) : undefined
        const levelName = o.level?.name ?? localLevel?.label
        const levelColor = o.level?.color ?? localLevel?.color
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
                {/* KAND-NIVEAU-1: the picked education level as a soft chip (§4 convention). */}
                {levelName && <SoftChip label={levelName} color={levelColor} />}
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

export function CertificationsTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments }: RelTabProps) {
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
    { key: 'name',    label: t('addFields.certName'),     half: true },
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
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.certificationsEmpty')} renderAddButton={renderAddButton}
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.name ?? cert.title}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              {/* Licence number (C-13b) — a code/ID, so JetBrains Mono per §4. */}
              {cert.license && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{t('addFields.licenseNumber')}: {cert.license}</div>}
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

export function SkillsTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments }: RelTabProps) {
  const { t } = useTranslation('candidates')
  // Level is a tenant lookup dropdown (SKILL-LVL-1), mirroring the languages editor.
  const { levels } = useSkillLevels()
  // DOC-LANG-SKILL-LINK-1: preview overlay for a row's linked proof document — the
  // shared house DocPreviewModal (never a fork), mirrors Education/Certifications.
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  // "Koppelen aan" picker options, resolved PER ROW — only documents no other entry
  // has claimed, plus this row's own pick (DOC-1-EIGENAAR-1).
  const documentOptions = linkedDocumentOptions(documents, items)
  const fields = [
    { key: 'name',  label: t('addFields.skill') },
    { key: 'level', label: t('addFields.skillLevel'), options: levels },
    // DOC-LANG-SKILL-LINK-1: optionally link an already-uploaded proof document to this
    // entry (only offered once the candidate HAS documents — §3, no fake affordance).
    ...(documents.length > 0 ? [{ key: 'document_id', label: t('addFields.linkedDocument'), options: documentOptions }] : []),
  ]
  // Skills render as a vertical list (one per row) so edit/remove read clearly.
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.skillsEmpty')} renderAddButton={renderAddButton}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const v = raw as { id?: Id; name?: string; skill?: string; level?: string }
        const name  = typeof raw === 'string' ? raw : (v.name ?? v.skill ?? '')
        const level = typeof raw === 'string' ? '' : (v.level ?? '')
        // DOC-LANG-SKILL-LINK-1: resolve the linked proof document, if any — icons
        // render only when found. A legacy plain-string skill has no id to link by.
        const linkedDoc = typeof raw === 'string' ? undefined : resolveLinkedDocument(raw, documents, 'skill_id')
        return (
          <div key={v.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', paddingRight: 56,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
                {level && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {level}</span>}
              </div>
              {linkedDoc && <DocEntryLinks doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
            </div>
          </div>
        )
      }} />
    {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
