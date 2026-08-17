/**
 * ReferencesTab — third-party references (referees) on the candidate's
 * Achtergrond sub-tab bar (KAND-REFERENTIES-1 / REFERENTIE-VELDEN-1). Mirrors
 * EducationTab/CertificationsTab's anatomy in SectionTabs.tsx (AddableSection +
 * a compact read row, same add/edit/remove affordances, the `document_id`
 * options-field idiom for the "reference letter" link — DOC-EDU-1) — plus one
 * extra per-row action: a subtle "verify" button that stamps the reference as
 * confirmed via POST /candidates/{id}/references/{item}/verify (BackgroundTab
 * wires the actual request; this component only renders the affordance and
 * calls the handler it is given).
 *
 * REFERENTIE-VELDEN-1 (Danny 08-08, three live messages — "Referentie voornaam,
 * achternaam middelnaam Functie relatie", "Telefoon en mobiel ... bijlage ...
 * Referentiebrief", "referentie document"). CMBE shipped the contract (commit
 * 9a9bd8c9, ReferenceResource): the name splits into first/middle/last (mirrors
 * NOODCONTACT-VELDEN-1's split), a `function` field (the referent's OWN role —
 * distinct from `relation_id`, their relation TO the candidate), `phone` +
 * `mobile` (both Phone-rule), the relation as a tenant lookup referenced BY ID
 * (never a free-text string — see useReferenceRelations), and an optional
 * reference-LETTER document link (`document_id`, mirrors
 * candidate_educations.document_id exactly — same "options" field idiom
 * EducationTab/CertificationsTab use, DOC-EDU-1). The OLD single `name` /
 * free-text `relation` fields no longer exist server-side.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { BadgeCheck, Eye, Download, ArrowRight } from 'lucide-react'
import AddableSectionJs from '@/components/forms/AddableSection'
import SafeHtml from '@/components/ui/SafeHtml'
import SoftChip from '@/components/ui/SoftChip'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import DrawerAddButton from './DrawerAddButton'
import { useRelationSort } from '@/components/forms/useRelationSort'
// REF-ERVARING-1: the reference ↔ work-experience link (contract measured live
// 09-08 — see referenceExperienceLink's header). Rules/labels live in the helper
// module, the two read-only views in LinkedExperience.
import { resolveLinkedExperience, useExperienceOptions, type LinkableExperience } from './referenceExperienceLink'
import { LinkedExperienceLine, NoExperiencesNotice } from './LinkedExperience'
import { useDateFormat } from '@/lib/datetime'
import { useReferenceRelations } from '@/lib/useReferenceRelations'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
// DOC-1-EIGENAAR-1: the ONE shared option resolver every claimable section uses (§11)
// — so all five sections offer exactly the same set of still-free documents.
import { linkedDocumentOptions } from './documentLinkRules'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// AddableSection is still untyped JS — accept any props at this boundary (mirrors SectionTabs.tsx).
const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

// Same short "+ Toevoegen" trigger every Achtergrond sub-tab uses (DRAWER-ADD-SHORT-1).
const renderAddButton = (onClick: () => void) => <DrawerAddButton onClick={onClick} short />

// Relation items vary at the prop boundary — kept loose like every other SectionTabs item.
export type RelItem = Record<string, unknown>

interface ReferencesTabProps {
  items?: RelItem[]
  onAdd?: (v: RelItem) => void
  onEdit?: (i: number, v: RelItem) => void
  onRemove?: (i: number) => void
  // The one action beyond generic CRUD. Omitted or the row not yet persisted →
  // no verify affordance at all (no fake button with nothing real behind it).
  onVerify?: (i: number) => void
  // DOC-EDU-1 mirror: the candidate's own documents (for the "reference letter"
  // edit-form picker + icon resolution) and a callback that switches the drawer
  // to the Documenten tab — mirrors EducationTab/CertificationsTab's props
  // exactly (SectionTabs.tsx RelTabProps).
  documents?: RelItem[]
  onJumpToDocuments?: () => void
  // REF-ERVARING-1: the candidate's OWN work experiences — the only valid link
  // targets (the backend scopes the FK to this candidate, 422 otherwise).
  experiences?: LinkableExperience[]
}

// A row is persisted once it carries a real backend id (a non-empty UUID string,
// never the negative temp id a fresh add gets before its POST resolves) — mirrors
// BackgroundTab's own isPersisted guard so the verify action never targets a row
// the server has never heard of.
const isPersisted = (id: unknown): id is string | number =>
  (typeof id === 'string' && id.length > 0) || (typeof id === 'number' && id > 0)

/** Read-only prose line for the note field — the shared house rule (§3A): every
 * free-text field renders through SafeHtml, never a bare textarea in read mode. */
function NoteField({ value }: { value?: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      {value
        ? <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }} />
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
    </div>
  )
}

/**
 * DOC-EDU-1 mirror, inlined here since ReferencesTab is a standalone file (out
 * of scope: SectionTabs.tsx's own `resolveLinkedDocument` only accepts its four
 * existing reverse keys and isn't touched by this change). Resolves the linked
 * reference-letter document from the row's own nested `document`
 * (ReferenceResource nests it — no second fetch needed) or by cross-referencing
 * the candidate's document list via `document_id` / the reverse `reference_id`.
 */
function resolveReferenceDocument(entry: RelItem, documents: RelItem[]): RelItem | undefined {
  const nested = entry.document
  if (nested && typeof nested === 'object') return nested as RelItem
  const docId = entry.document_id
  if (docId != null) {
    const byId = documents.find(d => String(d.id) === String(docId))
    if (byId) return byId
  }
  return documents.find(d => d.reference_id != null && String(d.reference_id) === String(entry.id))
}

/** Three subtle icon-buttons for a row's linked reference letter — same muted
 * style as SectionTabs.tsx's DocEntryLinks (not imported: it isn't exported,
 * and that file is out of scope for this change). */
function ReferenceLetterLink({ doc, onPreview, onJump }: { doc: RelItem; onPreview: () => void; onJump?: () => void }) {
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

export default function ReferencesTab({ items = [], onAdd, onEdit, onRemove, onVerify, documents = [], onJumpToDocuments, experiences = [] }: ReferencesTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // REFERENTIE-VELDEN-1: the relation lookup, searchable + pick-only (CLAUDE.md
  // §4 — never a hardcoded option list). Sent BY ID, never label/slug.
  const { referenceRelations } = useReferenceRelations()
  const relationOptions = referenceRelations.map(r => ({ value: r.id, label: r.label }))
  // DOC-EDU-1 mirror: "reference letter" picker options, resolved PER ROW — only
  // documents no other entry has claimed, plus this row's own pick
  // (DOC-1-EIGENAAR-1, mirrors EducationTab's documentOptions in SectionTabs.tsx).
  const documentOptions = linkedDocumentOptions(documents, items)
  // REF-ERVARING-1: the work-experience picker's options — persisted experiences
  // only, labelled exactly like the read line ("werkgever · functie · periode").
  // Several references may point at the SAME experience (a manager and a colleague
  // at one employer), so unlike the document link this list is never exclusive.
  const experienceOptions = useExperienceOptions(experiences)
  // DOC-EDU-1 mirror: preview overlay for a row's linked reference letter — the
  // shared house DocPreviewModal (never a fork).
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)

  // Field order mirrors EmergencyContactCard's own split-name order (Danny's own
  // phrasing, "voornaam achternaam middelnaam functie relatie") — first+last
  // pair on the top row, then middle+function; relation stays its own full-width
  // searchable dropdown; employer+phone and mobile+email pair next (§3A field
  // layout: pair short fields into two columns); the reference letter picker and
  // the free-text block close the form.
  const fields = [
    { key: 'first_name',  label: t('addFields.referenceFirstName', { defaultValue: 'Voornaam' }), half: true },
    // KAND-ACHTERGROND-VERPLICHT-1: `last_name` is required on create
    // (CandidateReferenceController::rules, measured 2026-08-17 — REFERENTIE-VELDEN-1's
    // own header already notes it "mirrors the old `name` requiredness").
    { key: 'last_name',   label: t('addFields.referenceLastName', { defaultValue: 'Achternaam' }), half: true, required: true },
    { key: 'middle_name', label: t('addFields.referenceMiddleName', { defaultValue: 'Tussenvoegsel' }), half: true },
    { key: 'function',    label: t('addFields.referenceFunction', { defaultValue: 'Functie' }), half: true },
    // Relation TO the candidate (manager/collega/klant/…) — a SEPARATE tenant
    // lookup from `function` (the referent's own role), sent by id.
    { key: 'relation_id', label: t('addFields.relation', { defaultValue: 'Relatie' }), options: relationOptions },
    { key: 'employer',    label: t('addFields.employer', { defaultValue: 'Werkgever' }), half: true },
    { key: 'phone',       label: t('addFields.phone', { defaultValue: 'Telefoon' }), half: true, type: 'tel' },
    { key: 'mobile',      label: t('addFields.mobile', { defaultValue: 'Mobiel' }), half: true, type: 'tel' },
    { key: 'email',       label: t('addFields.email', { defaultValue: 'E-mailadres' }), half: true },
    // DOC-EDU-1 mirror: optionally link an already-uploaded proof document (the
    // reference letter) to this entry — same "options" idiom, own field. Offered only
    // once the candidate HAS documents (§3, no always-empty dropdown).
    ...(documents.length > 0 ? [{ key: 'document_id', label: t('addFields.referenceLetter', { defaultValue: 'Referentiebrief' }), options: documentOptions }] : []),
    // REF-ERVARING-1 (Danny 08-08 punt 4): the experience this referee is the
    // reference FOR. Same "options" idiom as the reference-letter link right above
    // — a searchable, pick-only CreatableSelect whose clear (X) unlinks, i.e. the
    // very same PATCH with null (BackgroundTab's TO_API maps '' → null). Offered
    // only once the candidate HAS an experience; NoExperiencesNotice explains the
    // absence instead of showing an empty picker (§3).
    ...(experienceOptions.length > 0 ? [{ key: 'work_experience_id', label: t('addFields.workExperience'), options: experienceOptions }] : []),
    // Danny 08-08: this free-text block is the REFERENCE's own text, not a
    // generic note — the profile block next to it is labelled by what it is, so
    // this one is too ("Referentietekst", key referenceText).
    { key: 'note',        label: t('addFields.referenceText', { defaultValue: 'Referentietekst' }), richtext: true },
  ]
  // Sub-tab sort notes: candidate_references has no date column at all, so
  // start/end date are omitted — but it DOES carry the referent's own
  // `function` (their role, e.g. "Teamleider", distinct from `relation_id` —
  // their relation TO the candidate), a real field on every row, so that is
  // the one axis offered here (Requirement 2).
  const { order, control } = useRelationSort(items, {
    storageKey: 'references',
    functionOf: (raw: RelItem) => raw.function as string | undefined,
    functionLabel: t('addFields.referenceFunction', { defaultValue: 'Functie' }),
  })
  return (
    <>
    {/* REF-ERVARING-1: a candidate without a single work experience gets a calm
        explanation instead of a picker with nothing in it — but only where a
        recruiter would look for the link, i.e. once there is at least one reference. */}
    {items.length > 0 && experienceOptions.length === 0 && <NoExperiencesNotice />}
    <AddableSection title={null} emptyText={t('sections.referencesEmpty', { defaultValue: 'Nog geen referenties.' })}
      renderAddButton={renderAddButton} order={order} headerExtra={control}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const r = raw as {
          id?: Id; first_name?: string; middle_name?: string; last_name?: string; function?: string
          relation_id?: string; relation?: { id?: string; label?: string }
          employer?: string; phone?: string; mobile?: string; email?: string
          note?: string; verified_at?: string | null; verifiedAt?: string | null
        }
        // Composed name — mirrors the candidate's own first+middle+last display order.
        const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ')
        // Relation label: the nested {id,label} the API returns wins (no extra lookup,
        // EducationTab's level pattern — SectionTabs.tsx); a row just added/edited
        // THIS session (before the server echoes it back) falls back to resolving
        // the picked id against the loaded lookup.
        const relationLabel = r.relation?.label ?? referenceRelations.find(x => x.id === r.relation_id)?.label
        const secondary = [relationLabel, r.function, r.employer].filter(Boolean).join(' · ')
        const contact = [r.phone, r.mobile, r.email].filter(Boolean).join(' · ')
        const verifiedAt = r.verifiedAt ?? r.verified_at ?? null
        // DOC-EDU-1 mirror: resolve the linked reference letter, if any.
        const linkedDoc = resolveReferenceDocument(raw, documents)
        // REF-ERVARING-1: the linked work experience — resolved by ID against this
        // candidate's own list, so a just-cleared or just-switched link reads right
        // even before the drawer refetches (the PATCH response leaves the nested
        // object stale — see referenceExperienceLink's header).
        const linkedExperience = resolveLinkedExperience(raw, experiences)
        return (
          <div key={r.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name || '-'}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              {contact && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact}</div>}
              <NoteField value={r.note} />
              {/* REF-ERVARING-1: the linked experience reads as one calm line —
                  "werkgever · functie · periode", "heden" for a running job. */}
              {linkedExperience && <LinkedExperienceLine experience={linkedExperience} />}
              {/* REFERENTIE-VELDEN-1: the reference-letter icons only render once a
                  linked document actually resolves — no fake affordance. */}
              {linkedDoc && <ReferenceLetterLink doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
              {/* Verified badge once the server has stamped it, else the verify action —
                  never both, and no action at all for an unpersisted (temp id) row. */}
              <div style={{ marginTop: 6 }}>
                {verifiedAt ? (
                  <SoftChip color="var(--color-success)" label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <BadgeCheck size={12} />
                      {t('references.verified', { defaultValue: 'Geverifieerd' })} · {formatDate(verifiedAt)}
                    </span>
                  } />
                ) : (onVerify && isPersisted(r.id)) ? (
                  <button type="button" onClick={() => onVerify(i)}
                    title={t('references.verify', { defaultValue: 'Verifiëren' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
                      border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11,
                      color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <BadgeCheck size={12} />
                    {t('references.verify', { defaultValue: 'Verifiëren' })}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )
      }} />
    {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
