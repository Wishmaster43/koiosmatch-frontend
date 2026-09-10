/**
 * PendingUploadQueue — the staged, not-yet-uploaded file list shown above the
 * documents table: per-file type + optional "Koppelen aan" ("Link to") link
 * picker (DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1), an "apply to all" type
 * shortcut, and Add/Cancel. Split out of DocumentsSection (§3 size
 * discipline) — purely presentational, all state lives in the parent.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import DocumentLinkPicker from './DocumentLinkPicker'
// HUISSTIJL-1: the shared muted-caption atom (identity-only swap).
import { Caption } from '@/components/ui/typography'
import type { LookupOption } from '@/types/common'
import type { DocumentLinkSources } from './documentHelpers'
import DocTypeChipRow from '@/components/drawer/DocTypeChipRow'
import { pendingUploadTitle } from '@/components/drawer/pendingUploadTitle'
// DRY round 11, DOCS/DOCTABS: the tinted card frame, row wrappers, per-row type
// select, remove glyph and upload/cancel footer shared with the customer
// drawer's twin PendingUploadCard.
import {
  PendingUploadFrame, PendingUploadRows, PendingUploadRow,
  PendingUploadTypeSelect, PendingUploadRemoveButton, PendingUploadFooter,
} from '@/components/drawer/PendingUploadFrame'

// A queued-but-not-yet-uploaded file, each with its own document type (BUGFIX
// 23-07: a multi-file pick used to collapse to a single pending slot, so picking
// 5 files silently uploaded only 1 — now every picked file gets its own queue entry).
// DOC-ENTRY-LINK-1: `linkTo` is an OPTIONAL "education:<id>" / "certification:<id>"
// pick from the "Koppelen aan" ("Link to") grouped select — '' means no link.
export interface PendingItem { file: File; objectUrl: string; name: string; size: string; type: string; linkTo: string }

// DOC-1-EIGENAAR-1 / DOC-LANG-SKILL-LINK-1 / REFERENTIE-VELDEN-1: the five source
// lists mirror DocumentLinkSources, but `references` stays OPTIONAL here (empty-array
// default so an older caller keeps rendering exactly as before) — DocumentRow's own
// copy requires it, so this narrows it back to optional rather than widening the
// shared type for every consumer.
interface PendingUploadQueueProps extends Omit<DocumentLinkSources, 'references'> {
  pending: PendingItem[]
  docTypes: LookupOption[]
  references?: DocumentLinkSources['references']
  onSetType: (idx: number, type: string) => void
  onSetAllTypes: (type: string) => void
  onSetLink: (idx: number, linkTo: string) => void
  onRemove: (idx: number) => void
  onUploadAll: () => void
  onCancel: () => void
}

// The staged-file upload queue; purely presentational.
export default function PendingUploadQueue({
  pending, docTypes, educations, certifications, languages, skills, references = [], onSetType, onSetAllTypes, onSetLink, onRemove, onUploadAll, onCancel,
}: PendingUploadQueueProps) {
  const { t } = useTranslation('candidates')
  // Base id for each queued file's type-picker sr-only label — SelectMenu's
  // trigger is a <button>, which ignores an associated <label for> (mirrors the
  // exact same pattern in customers/drawer/DocumentsTab.tsx).
  const docTypeLabelBaseId = useId()
  if (pending.length === 0) return null
  return (
    <PendingUploadFrame title={pendingUploadTitle(pending, t('documents.pendingCount', { count: pending.length }))}>
      {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
      <Caption as="div" style={{ marginBottom: 6 }}>
        {pending.length > 1 ? t('documents.applyTypeToAll') : t('documents.docType')}
      </Caption>
      {/* §4 soft-tint (audit r4): active = tinted, never a solid primary fill. A
          chip is "active" only when EVERY queued item already shares that type
          (DocTypeChipRow itself carries the CHIP-TINT-1 recipe). */}
      <DocTypeChipRow options={docTypes} isActive={value => pending.length > 0 && pending.every(p => p.type === value)}
        onPick={onSetAllTypes} />
      {/* One compact row per queued file — its own type select + link picker + remove. */}
      <PendingUploadRows>
        {pending.map((item, idx) => (
          <PendingUploadRow key={idx} name={item.name} size={item.size}>
            <PendingUploadTypeSelect labelId={`${docTypeLabelBaseId}-${idx}`} label={t('documents.docTypeFor', { name: item.name })}
              value={item.type} onChange={v => onSetType(idx, v)} options={docTypes} />
            {/* DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1 / REFERENTIE-VELDEN-1: OPTIONAL
                "Koppelen aan" — grouped by education/certification/language/skill/
                reference. Entries that already carry a document are filtered out by the
                picker itself (DOC-1-EIGENAAR-1). */}
            <DocumentLinkPicker ariaLabel={t('documents.linkToFor', { name: item.name })} value={item.linkTo} onChange={v => onSetLink(idx, v)}
              educations={educations} certifications={certifications} languages={languages} skills={skills} references={references} />
            <PendingUploadRemoveButton onClick={() => onRemove(idx)} ariaLabel={t('common:remove')} />
          </PendingUploadRow>
        ))}
      </PendingUploadRows>
      <PendingUploadFooter
        addLabel={pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('common:add')}
        cancelLabel={t('common:cancel')}
        onAdd={onUploadAll} onCancel={onCancel}
      />
    </PendingUploadFrame>
  )
}
