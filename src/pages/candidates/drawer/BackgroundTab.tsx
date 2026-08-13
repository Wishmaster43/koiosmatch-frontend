import { useState } from 'react'
import type { ComponentType, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
// §10: one shared server-message extractor — never a bare "actie mislukt" where the
// backend told us exactly what is wrong (DOC-1-EIGENAAR-1's 422, a validation error, …).
import { extractApiError } from '@/lib/extractApiError'
import { ExperienceTab as ExperienceTabJs, EducationTab as EducationTabJs, CertificationsTab as CertificationsTabJs, SkillsTab as SkillsTabJs } from './SectionTabs'
import LanguagesSection from './LanguagesSection'
import ReferencesTab from './ReferencesTab'
import SubTabBar from '@/components/drawer/SubTabBar'
import type { Candidate } from '@/types/candidate'

type RelItem = Record<string, unknown>
type RelTabProps = {
  items?: RelItem[]; onAdd?: (v: RelItem) => void; onEdit?: (i: number, v: RelItem) => void; onRemove?: (i: number) => void
  // DOC-ENTRY-LINK-1/DOC-ERV-1: Education/Certifications/Skills/References/Experience
  // all resolve+show a linked proof document via these two props (read-only display
  // for Experience — there is no "Koppelen aan" edit-form picker on that tab).
  documents?: RelItem[]; onJumpToDocuments?: () => void
}

// SectionTabs is still untyped JS — declare the relation-list props used here.
const ExperienceTab     = ExperienceTabJs     as ComponentType<RelTabProps>
const EducationTab      = EducationTabJs      as ComponentType<RelTabProps>
const CertificationsTab = CertificationsTabJs as ComponentType<RelTabProps>
const SkillsTab         = SkillsTabJs         as ComponentType<RelTabProps>

/**
 * Background tab — experience, education, certifications, skills.
 *
 * Each list is optimistic local state that also persists to the candidate's
 * sub-entity routes (POST/PATCH/DELETE /candidates/{id}/{relation}). New items
 * get a negative temp id until the POST returns the server id; edit/remove only
 * hit the API once a real (positive numeric) id exists. A rejected request shows
 * a toast AND reverts the optimistic write (see `ops` below) — it never leaves
 * an unsaved change sitting on screen as if it had persisted.
 */
// Monotonic counter appended to every temp id: `-Date.now()` alone is NOT unique
// when several rows are added within the same millisecond (mirrors the identical
// fix in useEntityDocuments.ts, Danny 28-07) — each add now gets its own negative id.
let tempRelSeq = 0

const TO_API: Record<string, (v: RelItem) => Record<string, unknown>> = {
  experiences: v => ({
    function_title: v.title, employer: v.company, location: v.location,
    // end_date rides along even when current=true (Danny 24-07) — a current job
    // may carry a known end date; 'current' is a flag, not an eraser.
    start_date: v.start, end_date: v.end ?? null,
    current: !!v.current, description: v.desc,
  }),
  educations: v => ({
    title: v.title, school: v.school, start_date: v.start,
    end_date: v.end, in_progress: !!v.inProgress, description: v.desc, issue_date: v.inProgress ? null : v.issued,
    // DOC-EDU-1: the "Koppelen aan" picker's select value — '' (nothing chosen) means unlink.
    document_id: v.document_id || null,
    // NIVEAU-1: the education-level pick (id reference; '' = none) — without this
    // line the picker was a fake affordance (the whitelist dropped it on save).
    level_id: v.level_id || null,
  }),
  certifications: v => ({
    name: v.name, organisation: v.org, issue_date: v.issued,
    expiry_date: v.noExpiry ? null : v.expires, license_number: v.license, description: v.desc,
    // DOC-GELDIGHEID-1: mirrors the education mapping exactly.
    document_id: v.document_id || null,
  }),
  // DOC-LANG-SKILL-LINK-1: document_id belongs here too — measured live 08-08,
  // PATCH /candidates/{id}/skills/{skill} persists it (200, echoed back). It was
  // missing, so the skills picker's pick was dropped on save (a fake affordance).
  skills: v => ({ name: v.name, level: v.level, document_id: v.document_id || null }),
  // REFERENTIE-VELDEN-1: candidate_references columns — a straight passthrough,
  // ReferenceResource's field names already match the form's own keys 1:1 (no
  // FE→BE renaming needed, mirrors the old contract's shape). relation_id and
  // document_id are nullable FKs — '' (nothing picked) must send null, never an
  // empty string (mirrors educations/certifications' document_id handling).
  references: v => ({
    first_name: v.first_name, middle_name: v.middle_name, last_name: v.last_name,
    function: v.function, relation_id: v.relation_id || null, employer: v.employer,
    phone: v.phone, mobile: v.mobile, email: v.email, note: v.note,
    document_id: v.document_id || null,
    // REF-ERVARING-1 (Danny 08-08 punt 4, backend commit d6eb75cb): the work
    // experience this referee vouches for. Measured live 09-08 — PATCH
    // /candidates/{c}/references/{r} persists it (200 + a fresh GET echoes the id
    // AND a nested `work_experience`), a foreign candidate's experience is rejected
    // 422 (IDOR-safe), and unlinking is this same PATCH with null. So '' (picker
    // cleared) must send null, exactly like document_id/relation_id above.
    work_experience_id: v.work_experience_id || null,
  }),
}

export default function BackgroundTab({ c, onEditSave, onJump }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; onJump?: (tab: string) => void }) {
  const [experiences, setExperiences] = useState<RelItem[]>(c.experiences ?? [])
  const [educations,  setEducations]  = useState<RelItem[]>(c.educations ?? [])
  const [certs,       setCerts]        = useState<RelItem[]>(c.certifications ?? [])
  // Candidate.skills is string[] from the mapper, but the SkillsTab edits them as
  // { name, level } objects (it renders both) — widen to the relation-item shape.
  const [skills,      setSkills]       = useState<RelItem[]>((c.skills ?? []) as unknown as RelItem[])
  // REFERENTIE-VELDEN-1: `references` now lands on the Candidate type/mapper
  // (mapCandidate.ts) — the old defensive cast is gone, this reads the same way
  // every sibling relation list above does.
  const [references,  setReferences]   = useState<RelItem[]>(c.references ?? [])
  // 'common' stays the default ns (bare t('actionFailed') below); candidates:
  // strings (the sub-tab labels) use the explicit prefix.
  const { t, i18n } = useTranslation(['common', 'candidates'])

  // A row is persisted (has a server id) once it isn't the negative temp placeholder:
  // a non-empty UUID string (backend uses UUIDs) or a positive legacy numeric id.
  const isPersisted = (id: unknown): id is string | number =>
    (typeof id === 'string' && id.length > 0) || (typeof id === 'number' && id > 0)

  // Checkbox side-effects mirrored locally (the API mapper already applies them):
  // current → no end date, in progress → no diploma date, always-valid → no expiry.
  const NORMALIZE: Record<string, (v: RelItem) => RelItem> = {
    experiences:    v => v,
    educations:     v => (v.inProgress ? { ...v, issued: null } : v),
    certifications: v => (v.noExpiry ? { ...v, expires: null } : v),
    skills:         v => v,
    references:     v => v,
  }

  // add / edit-at-index / remove-at-index for a relation, with optimistic persistence.
  // Not-yet-persisted rows get a negative temp id (never collides with server ids).
  // Bug-class fix (optimistic-revert audit): all three used to fail soft — a
  // rejected request left the optimistic write sitting on screen with only a
  // toast, so the recruiter believed it had saved. Each op now reverts SURGICALLY
  // (mirrors useEntityDocuments.remove): onAdd drops the orphaned temp row, onEdit
  // restores the exact previous row, onRemove re-inserts the removed row at its
  // ORIGINAL index — never a whole-list snapshot, which would resurrect rows a
  // different in-flight call already removed successfully.
  // DOC-1-EIGENAAR-1 (Danny 08-08 punt 5): a 422 on these routes is an EXPECTED,
  // caller-handled outcome (e.g. "Dit document is al aan een ander onderdeel
  // gekoppeld.") — quietStatuses suppresses api.ts's generic dev diagnostic toast
  // ("API PATCH … → 422") so the server's own readable reason is what the user reads.
  const REQUEST_CONFIG = { quietStatuses: [422] }
  const ops = (rel: string, list: RelItem[], set: Dispatch<SetStateAction<RelItem[]>>) => ({
    onAdd: (raw: RelItem) => {
      const v = NORMALIZE[rel](raw)
      const id = -(Date.now() + (++tempRelSeq))
      set(p => [...p, { ...v, id }])
      api.post(`/candidates/${c.id}/${rel}`, TO_API[rel](v), REQUEST_CONFIG)
        .then(r => { const it = unwrap<RelItem>(r); if (it?.id) set(p => p.map(x => x.id === id ? { ...v, ...it } : x)) })
        .catch(err => { set(p => p.filter(x => x.id !== id)); notifyError(extractApiError(err, t('actionFailed'))) })
    },
    onEdit: (i: number, raw: RelItem) => {
      // Merge over the stored row FIRST: SectionTabs now has two independent editors
      // per item (the row form for name/dates/… and the description's own rich-text
      // pencil, ProseField) that each submit only their own subset — merging guarantees
      // the PATCH always carries the full, current record so one editor never silently
      // blanks the field the other one owns.
      const before = list[i]
      const v = NORMALIZE[rel]({ ...list[i], ...raw })
      const id = list[i]?.id
      set(p => p.map((x, idx) => idx === i ? { ...x, ...v } : x))
      if (isPersisted(id)) {
        api.patch(`/candidates/${c.id}/${rel}/${id}`, TO_API[rel](v), REQUEST_CONFIG).catch(err => {
          if (before) set(p => p.map(x => x.id === id ? before : x))
          notifyError(extractApiError(err, t('actionFailed')))
        })
      }
    },
    onRemove: (i: number) => {
      const id = list[i]?.id
      const row = list[i]
      set(p => p.filter((_, idx) => idx !== i))
      if (!isPersisted(id)) return
      api.delete(`/candidates/${c.id}/${rel}/${id}`).catch(err => {
        if (row) set(p => { const next = [...p]; next.splice(Math.min(i, next.length), 0, row); return next })
        notifyError(extractApiError(err, t('actionFailed')))
      })
    },
  })

  // KAND-REFERENTIES-1: verify is a one-way server stamp (verified_at/verified_by
  // are NOT fillable client fields — see CandidateReferenceController::verify), so
  // this waits for the real response instead of optimistically guessing it, then
  // merges the returned row (which carries the stamp) into state.
  const verifyReference = (i: number) => {
    const id = references[i]?.id
    if (!isPersisted(id)) return
    api.post(`/candidates/${c.id}/references/${id}/verify`)
      .then(r => { const it = unwrap<RelItem>(r); if (it) setReferences(p => p.map(x => x.id === id ? { ...x, ...it } : x)) })
      .catch(err => notifyError(extractApiError(err, t('actionFailed'))))
  }

  // House sub-tab bar (Danny kandidaten-ronde-2, punt B): one sub-tab per section
  // instead of five stacked blocks. Order is ALPHABETICAL BY TRANSLATED LABEL —
  // computed at render time, not hardcoded, so the tab order still reads correctly
  // once another locale reorders Education/Experience relative to each other
  // (e.g. NL: Certificeringen·Ervaring·Opleiding·Talen·Vaardigheden vs EN:
  // Certifications·Education·Experience·Languages·Skills). The DEFAULT open tab
  // is always Ervaring/Experience regardless of where the sort lands it.
  const SUB_TABS = [
    { id: 'certifications', label: t('candidates:sections.certifications') },
    { id: 'experience',     label: t('candidates:sections.experience') },
    { id: 'education',      label: t('candidates:sections.education') },
    { id: 'languages',      label: t('candidates:sections.languages') },
    // KAND-REFERENTIES-1: the defaultValue keeps the tab labelled before the
    // manager applies the reported key to the locale files (see AddableSection's
    // identical t(key, { defaultValue }) convention for 'edit'/'remove').
    { id: 'references',     label: t('candidates:sections.references', { defaultValue: 'Referenties' }) },
    { id: 'skills',         label: t('candidates:sections.skills') },
  ].sort((a, b) => a.label.localeCompare(b.label, i18n.language))
  const [subTab, setSubTab] = useState('experience')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {/* DOC-ERV-1: documents/onJumpToDocuments feed the read-only proof-document
          icons on a work-experience row — same pattern as Education below. */}
      {subTab === 'experience'     && <ExperienceTab     items={experiences} documents={c.documents ?? []} onJumpToDocuments={onJump ? () => onJump('documents') : undefined} {...ops('experiences', experiences, setExperiences)} />}
      {/* DOC-ENTRY-LINK-1: candidate.documents feeds both the "Koppelen aan" edit-form
          picker and the 3 read-only link icons; onJumpToDocuments switches the drawer
          to the Documenten tab (thin passthrough — CandidateDrawer owns tab state). */}
      {subTab === 'education'      && <EducationTab      items={educations}  documents={c.documents ?? []} onJumpToDocuments={onJump ? () => onJump('documents') : undefined} {...ops('educations', educations, setEducations)} />}
      {subTab === 'certifications' && <CertificationsTab items={certs}       documents={c.documents ?? []} onJumpToDocuments={onJump ? () => onJump('documents') : undefined} {...ops('certifications', certs, setCerts)} />}
      {/* DOC-LANG-SKILL-LINK-1: Vaardigheden already renders the "gekoppeld document"
          picker, but never received `documents` — so it always resolved to an empty
          list (a dropdown with nothing in it, and no read-mode link icons). */}
      {subTab === 'skills'         && <SkillsTab         items={skills}      documents={c.documents ?? []} onJumpToDocuments={onJump ? () => onJump('documents') : undefined} {...ops('skills', skills, setSkills)} />}
      {/* KAND-REFERENTIES-1: onVerify is the one action outside the generic add/edit/
          remove ops() shape — it stamps server-only fields, so it stays a dedicated
          handler in this container instead of squeezing into TO_API/NORMALIZE.
          REFERENTIE-VELDEN-1: documents/onJumpToDocuments feed the "reference
          letter" picker + read-mode icons, mirrors Education/Certifications above. */}
      {/* REF-ERVARING-1: `experiences` is the LOCAL list, not c.experiences — an
          experience added this session is instantly linkable, and one just removed
          disappears from the picker. */}
      {subTab === 'references'     && <ReferencesTab      items={references}  documents={c.documents ?? []} experiences={experiences} onJumpToDocuments={onJump ? () => onJump('documents') : undefined} onVerify={verifyReference} {...ops('references', references, setReferences)} />}
      {/* Talen already lived on this tab (moved here from Profiel earlier) — now its
          own sub-tab instead of a stacked block; persists via the drawer's onUpdate. */}
      {subTab === 'languages'      && <LanguagesSection c={c} onEditSave={onEditSave} />}
    </div>
  )
}
