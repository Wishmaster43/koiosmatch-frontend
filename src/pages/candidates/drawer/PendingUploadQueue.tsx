import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import DocumentLinkPicker from './DocumentLinkPicker'
import type { Id, LookupOption } from '@/types/common'

// A queued-but-not-yet-uploaded file, each with its own document type (BUGFIX
// 23-07: a multi-file pick used to collapse to a single pending slot, so picking
// 5 files silently uploaded only 1 — now every picked file gets its own queue entry).
// DOC-ENTRY-LINK-1: `linkTo` is an OPTIONAL "education:<id>" / "certification:<id>"
// pick from the "Koppelen aan" grouped select — '' means no link.
export interface PendingItem { file: File; objectUrl: string; name: string; size: string; type: string; linkTo: string }

interface PendingUploadQueueProps {
  pending: PendingItem[]
  docTypes: LookupOption[]
  educations: Array<{ id?: Id; title?: string }>
  certifications: Array<{ id?: Id; name?: string }>
  // DOC-LANG-SKILL-LINK-1: same "Koppelen aan" mechanic, extended to languages/skills
  // — threaded straight through to DocumentLinkPicker (mirrors educations/certifications).
  languages: Array<{ id?: Id; language?: string; name?: string }>
  skills: Array<{ id?: Id; name?: string }>
  onSetType: (idx: number, type: string) => void
  onSetAllTypes: (type: string) => void
  onSetLink: (idx: number, linkTo: string) => void
  onRemove: (idx: number) => void
  onUploadAll: () => void
  onCancel: () => void
}

/**
 * PendingUploadQueue — the staged, not-yet-uploaded file list shown above the
 * documents table: per-file type + optional "Koppelen aan" link picker
 * (DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1), an "apply to all" type shortcut,
 * and Add/Cancel. Split out of DocumentsSection (§3 size discipline) — purely
 * presentational, all state lives in the parent.
 */
export default function PendingUploadQueue({
  pending, docTypes, educations, certifications, languages, skills, onSetType, onSetAllTypes, onSetLink, onRemove, onUploadAll, onCancel,
}: PendingUploadQueueProps) {
  const { t } = useTranslation('candidates')
  if (pending.length === 0) return null
  return (
    <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        {/* Single file keeps the old name+size header; a multi-pick shows a count instead. */}
        {pending.length === 1
          ? <>{pending[0].name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending[0].size})</span></>
          : t('documents.pendingCount', { count: pending.length })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        {pending.length > 1 ? t('documents.applyTypeToAll') : t('documents.docType')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {/* §4 soft-tint (audit r4): active = tinted, never a solid primary fill.
            A chip is "active" only when EVERY queued item already shares that type. */}
        {docTypes.map(dt => {
          const active = pending.length > 0 && pending.every(p => p.type === dt.value)
          return (
            <button key={dt.value} onClick={() => onSetAllTypes(dt.value)}
              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--surface)',
                color: active ? 'var(--color-primary)' : 'var(--text)' }}>{dt.label}</button>
          )
        })}
      </div>
      {/* One compact row per queued file — its own type select + link picker + remove. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {pending.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{item.size}</span>
            <select aria-label={t('documents.docTypeFor', { name: item.name })} value={item.type} onChange={e => onSetType(idx, e.target.value)}
              style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }}>
              {docTypes.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
            </select>
            {/* DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1: OPTIONAL "Koppelen aan" —
                grouped by education/certification/language/skill. */}
            <DocumentLinkPicker ariaLabel={t('documents.linkToFor', { name: item.name })} value={item.linkTo} onChange={v => onSetLink(idx, v)}
              educations={educations} certifications={certifications} languages={languages} skills={skills} />
            <button onClick={() => onRemove(idx)} aria-label={t('common:remove')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onUploadAll}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>
          {pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('common:add')}
        </button>
        <button onClick={onCancel}
          style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
      </div>
    </div>
  )
}
