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
// N008-DOC-EXPIRY-FE-1: the shared date-field atom (DATUM-1's only allowed raw
// date face — inside a native <input type="date">).
import { DateField } from '@/components/forms/fields'
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
// N008-DOC-EXPIRY-FE-1: `expiresAt` is an OPTIONAL Y-m-d date (from the DateField
// below) — '' means not set; harmless to keep across a type switch (the server
// side: "a sent expires_at always wins").
export interface PendingItem { file: File; objectUrl: string; name: string; size: string; type: string; linkTo: string; expiresAt?: string }

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
  // N008-DOC-EXPIRY-FE-1: optional — a caller without the expiry concept
  // (none today) simply omits it, and no expiry field ever renders.
  onSetExpiry?: (idx: number, expiresAt: string) => void
  onRemove: (idx: number) => void
  onUploadAll: () => void
  onCancel: () => void
}

// The staged-file upload queue; purely presentational.
export default function PendingUploadQueue({
  pending, docTypes, educations, certifications, languages, skills, references = [], onSetType, onSetAllTypes, onSetLink, onSetExpiry, onRemove, onUploadAll, onCancel,
}: PendingUploadQueueProps) {
  const { t } = useTranslation('candidates')
  // Base id for each queued file's type-picker sr-only label — SelectMenu's
  // trigger is a <button>, which ignores an associated <label for> (mirrors the
  // exact same pattern in customers/drawer/DocumentsTab.tsx).
  const docTypeLabelBaseId = useId()
  if (pending.length === 0) return null
  // N008-DOC-EXPIRY-FE-1: a row needs a REQUIRED-and-empty expiry when its
  // chosen type requires one and carries no default validity to fall back to —
  // the Add button stays disabled (honest, never silent) while any row is in
  // that state.
  const rowNeedsRequiredExpiry = (item: PendingItem) => {
    const opt = docTypes.find(o => o.value === item.type)
    return Boolean(opt?.requiresExpiry) && opt?.defaultValidityMonths == null && !item.expiresAt
  }
  const addDisabled = onSetExpiry ? pending.some(rowNeedsRequiredExpiry) : false
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
        {pending.map((item, idx) => {
          // N008-DOC-EXPIRY-FE-1: the row's chosen type decides whether an expiry
          // field renders at all, and whether it is required (no default
          // validity to fall back to) or optional (a default caption instead).
          const opt = docTypes.find(o => o.value === item.type)
          const needsExpiry = Boolean(opt?.requiresExpiry)
          const expiryRequired = needsExpiry && opt?.defaultValidityMonths == null
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <PendingUploadRow name={item.name} size={item.size}>
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
              {needsExpiry && onSetExpiry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                  <label htmlFor={`${docTypeLabelBaseId}-expiry-${idx}`} className="sr-only">{t('documents.expiryFor', { name: item.name })}</label>
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <DateField id={`${docTypeLabelBaseId}-expiry-${idx}`} aria-required={expiryRequired} required={expiryRequired}
                      value={item.expiresAt ?? ''} onChange={v => onSetExpiry(idx, v)}
                      style={{ fontSize: 11, padding: '4px 8px' }} />
                  </div>
                  {expiryRequired
                    ? <Caption style={{ color: 'var(--color-danger-text)' }}>*</Caption>
                    : <Caption>{t('documents.expiryDefault', { months: opt?.defaultValidityMonths })}</Caption>}
                </div>
              )}
            </div>
          )
        })}
      </PendingUploadRows>
      {addDisabled && (
        <Caption as="div" style={{ color: 'var(--color-danger-text)', marginBottom: 6 }}>{t('documents.expiryRequired')}</Caption>
      )}
      <PendingUploadFooter
        addLabel={pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('common:add')}
        cancelLabel={t('common:cancel')}
        onAdd={onUploadAll} onCancel={onCancel} addDisabled={addDisabled}
      />
    </PendingUploadFrame>
  )
}
