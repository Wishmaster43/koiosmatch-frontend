/**
 * PendingUploadQueue — the staged, not-yet-uploaded file list shown above the
 * documents table: per-file type + optional "Koppelen aan" ("Link to") link
 * picker (DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1), an "apply to all" type
 * shortcut, and Add/Cancel. Split out of DocumentsSection (§3 size
 * discipline) — purely presentational, all state lives in the parent.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import DocumentLinkPicker from './DocumentLinkPicker'
// G34: the house searchable dropdown replaces the native per-file type <select>.
import SelectMenu from '@/components/ui/SelectMenu'
// HUISSTIJL-1: the shared muted-caption atom (identity-only swap).
import { Caption } from '@/components/ui/typography'
import type { LookupOption } from '@/types/common'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { DocumentLinkSources } from './documentHelpers'
// DRY round 11, DOCS: the tinted card frame + row wrappers shared with the
// customer drawer's twin PendingUploadCard.
import { PendingUploadFrame, PendingUploadRows, PendingUploadRow } from '@/components/drawer/PendingUploadFrame'

// Hoisted: an inline accent literal under background: false-fires the accent-fill selector.
const ACCENT = 'var(--color-primary)'

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
  // Single file keeps the old name+size header; a multi-pick shows a count instead.
  const title = pending.length === 1
    ? <>{pending[0].name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending[0].size})</span></>
    : t('documents.pendingCount', { count: pending.length })
  return (
    <PendingUploadFrame title={title}>
      {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
      <Caption as="div" style={{ marginBottom: 6 }}>
        {pending.length > 1 ? t('documents.applyTypeToAll') : t('documents.docType')}
      </Caption>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {/* §4 soft-tint (audit r4): active = tinted, never a solid primary fill.
            A chip is "active" only when EVERY queued item already shares that type. */}
        {/* Choice-chips (CHIP-TINT-1): the lib/tint house pair + chipInk — was a
            hand-rolled 14/45 pair. Block form: the style attr spans the tag. */}
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
        {docTypes.map(dt => {
          const active = pending.length > 0 && pending.every(p => p.type === dt.value)
          return (
            <button key={dt.value} onClick={() => onSetAllTypes(dt.value)}
              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
                border: active ? tintBorder(ACCENT, true) : '1px solid var(--border)',
                background: active ? tintBg(ACCENT, true) : 'var(--surface)',
                color: active ? chipInk(ACCENT) : 'var(--text)' }}>{dt.label}</button>
          )
        })}
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
      </div>
      {/* One compact row per queued file — its own type select + link picker + remove. */}
      <PendingUploadRows>
        {pending.map((item, idx) => (
          <PendingUploadRow key={idx} name={item.name} size={item.size}>
            <span id={`${docTypeLabelBaseId}-${idx}`} className="sr-only">{t('documents.docTypeFor', { name: item.name })}</span>
            <div style={{ width: 130, flexShrink: 0 }}>
              <SelectMenu aria-labelledby={`${docTypeLabelBaseId}-${idx}`} value={item.type} onChange={v => onSetType(idx, v)}
                options={docTypes} menuWidth={160}
                style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            {/* DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1 / REFERENTIE-VELDEN-1: OPTIONAL
                "Koppelen aan" — grouped by education/certification/language/skill/
                reference. Entries that already carry a document are filtered out by the
                picker itself (DOC-1-EIGENAAR-1). */}
            <DocumentLinkPicker ariaLabel={t('documents.linkToFor', { name: item.name })} value={item.linkTo} onChange={v => onSetLink(idx, v)}
              educations={educations} certifications={certifications} languages={languages} skills={skills} references={references} />
            {/* 12px inline row-remove glyph in a dense queue row, not a Button copy
                (mirrors EntityHeader's chip-remove precedent). Block form: the
                style attr sits a line into the tag. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
            <button onClick={() => onRemove(idx)} aria-label={t('common:remove')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </PendingUploadRow>
        ))}
      </PendingUploadRows>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Herhaal-audit r4 finding 2's twin (customers DocumentsTab converted the
            same round): the inverse --text fill is retired — the card's primary
            action wears the house Button. */}
        <Button variant="primary" size="sm" onClick={onUploadAll}>
          {pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('common:add')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>{t('common:cancel')}</Button>
      </div>
    </PendingUploadFrame>
  )
}
