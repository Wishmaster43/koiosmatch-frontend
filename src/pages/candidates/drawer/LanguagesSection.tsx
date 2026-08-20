import { useState, useId } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, Eye, Download } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { useLanguageLookups } from '@/lib/useLanguageLookups'
import DrawerAddButton from './DrawerAddButton'
import Button from '@/components/ui/Button'
// DOC-1-EIGENAAR-1: the ONE shared "which document is still free" rule (§11).
import { documentLinkOptions } from './documentLinkRules'
// G34: the house searchable dropdown replaces the native <select> per language/level.
import CreatableSelect from '@/components/ui/CreatableSelect'
// KAND-ACHTERGROND-VERPLICHT-1: the ONE required-field marker (red asterisk) and
// the ONE inline validation message — same convention AddForm/AddCandidateModal use.
import { Label } from '@/components/forms/fields'
import FieldNotice from '@/components/ui/FieldNotice'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// The edit buffer's row. `id` is the server row id (absent on a freshly added row)
// and `documentId` is the TAAL-DOC-LINK-1 proof-document link ('' = none).
interface LangRow { id?: Id; language: string; spoken: string; written: string; documentId: string }
// The bulk save payload: language/levels persist through the candidate-level PATCH
// exactly as before (the document link does NOT — see save()). `id` rides along for
// a persisted row because the drawer OPTIMISTICALLY MERGES this payload over the
// candidate it holds — without it the merged language rows lost their id, and every
// linked document silently dropped off the chips until the next full refetch
// (measured live 08-08). The API accepts and ignores it (200, row ids unchanged).
interface LangSavePayload { id?: Id; language: string; spoken: string; written: string }
interface ApiLanguage {
  id?: Id; language?: string; name?: string; spoken?: string; written?: string
  // TAAL-DOC-LINK-1: LanguageResource ships both the FK and the nested document.
  document_id?: Id | null; document?: LinkedDocument | null
}
// Only the fields this section actually uses off a document — the shared preview
// modal and download helper read the same two url shapes. DOC-1-EIGENAAR-1: the five
// reverse-FK ids ride along too, so the picker can drop already-claimed documents.
interface LinkedDocument {
  id?: Id; name?: string; file_name?: string; url?: string; download_url?: string; type?: string
  education_id?: Id | null; certification_id?: Id | null; language_id?: Id | null; skill_id?: Id | null; reference_id?: Id | null
}

/**
 * LanguagesSection — the candidate's languages, fully editable (add / change /
 * remove) with dropdowns for taal + gesproken/schriftelijk niveau. Options come
 * from the tenant-configurable lists (Settings → Talen) with a package default.
 * Same in-place pencil ↔ save/cancel pattern as the profile blocks.
 *
 * TAAL-DOC-LINK-1 (Danny 08-08: "Talen: kan ik nog geen document koppelen"): a row
 * can now carry a proof document (taalcertificaat) — picked per row while editing,
 * previewed/downloaded from the read chip — mirroring what Opleiding /
 * Certificeringen / Vaardigheden / Referenties already offer.
 */
export default function LanguagesSection({ c, onEditSave }: { c: Candidate; onEditSave?: (v: { languages: LangSavePayload[] }) => void }) {
  const { t } = useTranslation('candidates')
  const { languages: langOpts, levels } = useLanguageLookups() as { languages: string[]; levels: string[] }
  // CreatableSelect's trigger is a <button>, which ignores a <label for> — a
  // per-row sr-only span + aria-labelledby names each document picker instead
  // (same pattern as DocumentLinkPicker).
  const labelBaseId = useId()

  const langs = (c.languages ?? []) as ApiLanguage[]
  // TAAL-DOC-LINK-1: the candidate's own documents feed the per-row picker — the
  // same source list the Documenten tab's "Koppelen aan" picker uses.
  const documents = ((c.documents ?? []) as unknown) as LinkedDocument[]

  // The SAVED link per persisted language row (row id → document id, '' = none).
  // Own state because the link has its own persistence path (see save()) and the
  // parent does not refetch the candidate after a sub-entity PATCH.
  const [docLinks, setDocLinks] = useState<Record<string, string>>(() => Object.fromEntries(
    langs.filter(l => l.id != null).map(l => [String(l.id), l.document_id != null ? String(l.document_id) : '']),
  ))
  const linkedDocId = (l: ApiLanguage): string => (l.id != null ? docLinks[String(l.id)] ?? '' : '')
  // Resolve a row's linked document: the candidate's own (mapper-normalised) list
  // first, the nested LanguageResource payload as fallback — mirrors SectionTabs'
  // resolveLinkedDocument, so both shapes render the same document.
  const linkedDoc = (l: ApiLanguage): LinkedDocument | null => {
    const id = linkedDocId(l)
    if (!id) return null
    return documents.find(d => String(d.id) === id) ?? l.document ?? null
  }

  const initial = (): LangRow[] => langs.map(l => ({
    id: l.id, language: l.language ?? l.name ?? '', spoken: l.spoken ?? '', written: l.written ?? '',
    documentId: linkedDocId(l),
  }))
  const [editing, setEditing] = useState(false)
  const [rows,    setRows]    = useState<LangRow[]>(initial)
  // The preview overlay for a row's linked document — the shared house modal, never a fork.
  const [previewDoc, setPreviewDoc] = useState<LinkedDocument | null>(null)
  // KAND-ACHTERGROND-VERPLICHT-1: rows (by index) a blocked Save flagged for having
  // content but no language — `language` is required on create
  // (CandidateLanguageController::rules, measured 2026-08-17). Cleared per-row the
  // moment its language is picked, mirrors AddForm's own `invalid` state.
  const [invalidRows, setInvalidRows] = useState<Record<number, boolean>>({})

  // DOC-1-EIGENAAR-1: the picker options for ONE row — every document no other entry
  // has claimed, plus this row's own pick so it stays visible and switchable. The
  // siblings come from the live edit BUFFER, so picking a document on row 1 removes it
  // from row 2's list immediately (a double-pick would otherwise 422 on save).
  const documentOptionsFor = (row: LangRow) => documentLinkOptions(
    documents,
    rows.map(r => ({ id: r.id, document_id: r.documentId || null })),
    { id: row.id, document_id: row.documentId || null },
  )

  const setRow    = (i: number, k: keyof LangRow, v: string) => {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
    // A row just given a language is no longer incomplete — clear its marker.
    if (k === 'language' && v) setInvalidRows(p => (p[i] ? { ...p, [i]: false } : p))
  }
  const addRow    = ()        => setRows(r => [...r, { language: '', spoken: '', written: '', documentId: '' }])
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))
  const cancel = () => { setRows(initial()); setInvalidRows({}); setEditing(false) }
  // Save in two paths, because the backend has two. Language + levels keep riding the
  // existing candidate-level bulk payload (unchanged shape). The document link does
  // NOT: MEASURED live 08-08 — PATCH /candidates/{id} answers 200 but silently drops
  // `document_id` on a language row, while PATCH /candidates/{id}/languages/{row}
  // persists it (and the reverse language_id then shows on the document). That is the
  // exact per-item relation route the Documenten tab's link picker already uses.
  const save = () => {
    // KAND-ACHTERGROND-VERPLICHT-1: a row with content but no language used to be
    // silently dropped by the `kept` filter below — no error, no explanation, the
    // typed spoken/written level or picked document just vanished. Block Save
    // instead and point at the row, mirroring every other sub-tab's required check.
    // A row with NOTHING filled at all stays a harmless no-op discard (unchanged).
    const incomplete = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !r.language.trim() && (r.spoken || r.written || r.documentId))
    if (incomplete.length) {
      setInvalidRows(Object.fromEntries(incomplete.map(({ i }) => [i, true])))
      return
    }
    const kept = rows.filter(r => r.language)
    onEditSave?.({ languages: kept.map(r => ({ ...(r.id != null ? { id: r.id } : {}), language: r.language, spoken: r.spoken, written: r.written })) })
    setInvalidRows({})
    setEditing(false)
    kept.forEach(r => {
      if (r.id == null || r.documentId === (docLinks[String(r.id)] ?? '')) return
      // DOC-1-EIGENAAR-1 (punt 5): a 422 here is the backend's own readable "already
      // linked" reason — quietStatuses keeps api.ts's generic dev toast from burying it.
      api.patch(`/candidates/${c.id}/languages/${r.id}`, { document_id: r.documentId || null }, { quietStatuses: [422] })
        // Only a confirmed write updates the read state — a refused PATCH leaves the
        // previous link on screen instead of pretending the new one saved.
        .then(() => setDocLinks(prev => ({ ...prev, [String(r.id)]: r.documentId })))
        .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
    })
  }
  // Download a linked document through the one shared helper (same mechanics as the
  // Documenten list row) — the in-app stream url first, the signed url as fallback.
  const downloadDoc = (doc: LinkedDocument) => downloadFilesSequentially([{ url: doc.url ?? doc.download_url, name: doc.name ?? doc.file_name ?? '' }])

  // Subtle, borderless icon button for the chip's preview/download actions — the
  // same muted treatment SectionTabs' own document links use.
  const chipIconBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }
  // CreatableSelect's own style prop only reaches its inner trigger button, not the
  // outer wrapping div — each picker below is wrapped in its own flex:1 container
  // so the three stay evenly sized in the row (mirrors the old selectStyle's flex).
  const pickerStyle: CSSProperties = { padding: '6px 8px', fontSize: 12, background: 'var(--input-bg)' }
  const view = langs

  return (
    <div>
      {/* No section title (Danny addendum 4): this only renders inside the
          Achtergrond → Talen sub-tab, whose bar already says "Talen" — mirrors
          ProfileTab's own "no section title, it would duplicate the tab label". */}
      {/* marginBottom 10 (Danny 08-08): with no section title, a 6px gap made the
          save/cancel cluster read as belonging to the FIRST row instead of the
          section — the trash beside it then looked out of line. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
        {/* "+ Taal" top-right, same reference style as + Match / Ervaring — ALWAYS
            visible (Danny 20-07: net als de andere secties): outside edit mode a
            click enters edit AND adds the fresh row in one go.
            Short text (DRAWER-ADD-SHORT-1, Danny 05-08): always inside the
            Achtergrond → Talen sub-tab, never a full page. */}
        <DrawerAddButton label={t('addFields.language')} short
          onClick={() => { if (!editing) { setRows([...initial(), { language: '', spoken: '', written: '', documentId: '' }]); setEditing(true) } else addRow() }} />
      </div>

      {/* The edit cluster lives INSIDE the card ("potlootje in talen box", Danny
          05-08) — pencil top-right of the block it edits, toggling to save/✕. */}
      {/* TRASH-ALIGN-1 (Danny 08-08, twice): in edit mode the save/✕ cluster used to
          FLOAT (absolute, top-right) over the first row and force a 68px right
          padding on every row — so row 1's trash sat next to two higher-placed
          buttons and never lined up with the rows below it. Editing now puts
          save/✕ on their OWN footer line under the rows, and the rows use the full
          card width, so every trash forms one clean column. The VIEW-mode pencil
          keeps its familiar floating top-right spot (nothing overlaps there). */}
      <div style={{ position: 'relative', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
        padding: editing ? '10px 12px' : '10px 40px 10px 12px' }}>
        {!editing && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
            <Button variant="secondary" size="sm" iconOnly onClick={() => { setRows(initial()); setEditing(true) }} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
          </div>
        )}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* KAND-ACHTERGROND-VERPLICHT-1: column captions above the row list (once,
                not per row — this is a repeating-row form, not a single-record one) so
                the required "Taal" column carries the shared Label's red asterisk. The
                trailing spacer matches the trash button's own 26px + gap so the three
                captions line up with their picker below. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}><Label required>{t('addFields.language')}</Label></div>
              <div style={{ flex: 1, minWidth: 0 }}><Label>{t('addFields.spokenLevel')}</Label></div>
              <div style={{ flex: 1, minWidth: 0 }}><Label>{t('addFields.writtenLevel')}</Label></div>
              <div style={{ width: 26, flexShrink: 0 }} aria-hidden="true" />
            </div>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CreatableSelect value={row.language || null} onChange={v => setRow(i, 'language', v)} allowCreate={false} clearable
                      placeholder={t('addFields.language')} options={langOpts}
                      style={invalidRows[i] ? { ...pickerStyle, borderColor: 'var(--color-danger)' } : pickerStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CreatableSelect value={row.spoken || null} onChange={v => setRow(i, 'spoken', v)} allowCreate={false} clearable
                      placeholder={t('addFields.spokenLevel')} options={levels} style={pickerStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CreatableSelect value={row.written || null} onChange={v => setRow(i, 'written', v)} allowCreate={false} clearable
                      placeholder={t('addFields.writtenLevel')} options={levels} style={pickerStyle} />
                  </div>
                  {/* Same 28×28 box (house Button size="sm") as every other icon button
                      in this card (Danny 08-08: "is stuk groter dan de andere 2 knopjes")
                      — one size for trash, save and ✕; the row centers it vertically. */}
                  <Button variant="dangerSoft" size="sm" iconOnly onClick={() => removeRow(i)} title={t('common:remove')} aria-label={t('common:remove')} style={{ flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </Button>
                </div>
                {/* KAND-ACHTERGROND-VERPLICHT-1: points at the row a blocked Save
                    flagged — content typed, but no language picked. */}
                {/* Explicit `common:` prefix — this file's default `t` resolves the
                    'candidates' namespace, and the shared field-required copy lives
                    in 'common' (extractApiError's own ERROR_CODE_KEYS convention). */}
                {invalidRows[i] && <FieldNotice text={t('common:errors.fieldRequired', { field: t('addFields.language') })} />}
                {/* TAAL-DOC-LINK-1: the proof-document picker on its own line, so the
                    trash column above stays one clean column (TRASH-ALIGN-1). Only for a
                    PERSISTED row and only when the candidate actually HAS documents — a
                    just-added row has no id the relation PATCH could target, and an empty
                    document list would be a picker resolving to nothing (§3). */}
                {row.id != null && documentOptionsFor(row).length > 0 && (
                  <div style={{ display: 'flex', paddingRight: 32 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span id={`${labelBaseId}-${i}`} className="sr-only">{t('addFields.linkedDocumentFor', { name: row.language })}</span>
                      <CreatableSelect aria-labelledby={`${labelBaseId}-${i}`} value={row.documentId || null}
                        onChange={v => setRow(i, 'documentId', v)} allowCreate={false} clearable
                        clearLabel={t('addFields.linkedDocument')}
                        placeholder={t('addFields.linkedDocument')} options={documentOptionsFor(row)} style={pickerStyle} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Save/✕ as a real footer line — right-aligned under the rows. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
              <Button variant="primary" size="sm" iconOnly onClick={save} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
              <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
            </div>
          </div>
        ) : view.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.languagesEmpty')}</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {view.map((l, i) => {
              // TAAL-DOC-LINK-1: the linked proof document's own actions — rendered
              // only once a document actually resolves (calm by default, no icons).
              const doc = linkedDoc(l)
              return (
                <span key={l.id ?? i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  {l.language ?? l.name}{l.spoken ? ` · ${l.spoken}` : ''}{l.written ? ` · ${l.written}` : ''}
                  {doc && (
                    <>
                      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline chip-scoped glyph sized to the 11px language pill, not a standalone Button */}
                      <button type="button" onClick={() => setPreviewDoc(doc)} style={chipIconBtn}
                        aria-label={t('documents.preview')} title={doc.name ?? doc.file_name ?? t('documents.preview')}><Eye size={11} /></button>
                      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline chip-scoped glyph sized to the 11px language pill, not a standalone Button */}
                      <button type="button" onClick={() => downloadDoc(doc)} style={chipIconBtn}
                        aria-label={t('documents.download')} title={t('documents.download')}><Download size={11} /></button>
                    </>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
