import { useTranslation } from 'react-i18next'
import { Pencil, Eye, X, RefreshCw, Link2, Download, GraduationCap, Award, Languages, Sparkles, UserCheck } from 'lucide-react'
import { resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import SoftChip from '@/components/ui/SoftChip'
import DocumentVersionHistory from './DocumentVersionHistory'
import DocumentLinkPicker from './DocumentLinkPicker'
import { splitExt, isPersisted, computeDocExpiry, docUrl, DOC_GRID_COLUMNS } from './documentHelpers'
import type { DocItem } from './documentHelpers'
import type { Id } from '@/types/common'

// DOC-LIST-LINK-1: the five kinds a document can be linked to — mirrors the reverse-FK
// ids the backend's DocumentResource serialises per row (education_id/certification_id/
// language_id/skill_id/reference_id; the FK itself lives on the OTHER side, e.g.
// candidate_educations.document_id). Kept as a LOCAL extension of the shared DocItem
// (rather than editing documentHelpers.ts, out of scope for this change) since
// DocumentRow and its owner DocumentsSection are the only readers. REFERENTIE-VELDEN-1
// adds 'reference' (candidate_references.document_id, commit 9a9bd8c9).
export type LinkKind = 'education' | 'certification' | 'language' | 'skill' | 'reference'
export interface LinkedDocItem extends DocItem {
  education_id?: Id | null
  certification_id?: Id | null
  language_id?: Id | null
  skill_id?: Id | null
  reference_id?: Id | null
}
/** One resolved link: which kind, which entry id, and that entry's own display label. */
export interface ResolvedDocLink { kind: LinkKind; id: Id; label: string }

// Icon + i18n section-key per kind — the icon tells the kind apart at a glance (point 1);
// the section key mirrors DocumentLinkPicker's own "<Group> · <label>" grouping so the
// row chip's tooltip reads identically to the picker's option text.
const LINK_KIND_ICON: Record<LinkKind, typeof GraduationCap> = { education: GraduationCap, certification: Award, language: Languages, skill: Sparkles, reference: UserCheck }
const LINK_KIND_SECTION_KEY: Record<LinkKind, string> = { education: 'sections.education', certification: 'sections.certifications', language: 'sections.languages', skill: 'sections.skills', reference: 'sections.references' }

interface DocumentRowProps {
  d: DocItem
  selected: boolean
  downloadable: boolean
  onToggleSelect: () => void
  canManage: boolean
  renaming: boolean
  renameValue: string
  onRenameStart: () => void
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onReplace: () => void
  // PDF-VACATURES-26: the vacancy documents tab reuses this row but has no
  // /vacancies/{id}/documents/{id}/replace route yet — omitting the button rather
  // than wiring it to a dead endpoint (§3 no fake affordance). Defaults true so
  // every existing caller (candidate) keeps its Replace button unchanged.
  canReplace?: boolean
  onPreview: () => void
  onDeleteRequest: () => void
  docColor: (type?: string) => string
  docTypeLabel: (type?: string) => string
  docTypeIcon?: (type?: string) => string | null | undefined
  // DOC-LIST-LINK-1: the resolved link chip (null = unlinked, renders no chip — point 1)
  // + the inline "Koppelen aan" picker's open/value/handlers + its own source lists
  // (point 2). The actual PATCH(es) live in the parent (DocumentsSection) — this
  // component only renders props and fires the callbacks it was given.
  linked: ResolvedDocLink | null
  linking: boolean
  linkValue: string
  canLink: boolean
  onLinkToggle: () => void
  onLinkChange: (value: string) => void
  // DOC-1-EIGENAAR-1: each entry's own `document_id` rides along so DocumentLinkPicker
  // can drop the slots that are already taken (one rule, applied inside the picker).
  educations: Array<{ id?: Id; title?: string; document_id?: Id | null }>
  certifications: Array<{ id?: Id; name?: string; document_id?: Id | null }>
  languages: Array<{ id?: Id; language?: string; name?: string; document_id?: Id | null }>
  skills: Array<{ id?: Id; name?: string; document_id?: Id | null }>
  // REFERENTIE-VELDEN-1: same mechanic, extended to references.
  references: Array<{ id?: Id; first_name?: string; middle_name?: string; last_name?: string; document_id?: Id | null }>
}

/**
 * DocumentRow — one document list row: checkbox, type tile + name (or its inline
 * rename input), the DOC-EXPIRY-1 expiry chip, the DOC-LIST-LINK-1 link chip (+ its
 * inline re-link picker), the DOC-VERSIE-1 version-history toggle, type chip, size,
 * and the row actions. Split out of DocumentsSection (§3 size discipline) — purely
 * presentational, every persistence path lives in the parent; this component only
 * renders props and fires the callbacks it was given.
 */
export default function DocumentRow({
  d, selected, downloadable, onToggleSelect, canManage,
  renaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
  onReplace, canReplace = true, onPreview, onDeleteRequest, docColor, docTypeLabel, docTypeIcon,
  linked, linking, linkValue, canLink, onLinkToggle, onLinkChange, educations, certifications, languages, skills, references,
}: DocumentRowProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // The type's own curated icon (fallback FileText) — so rows stand out per type.
  // Optional-chained: older test mocks of useDocumentTypes don't stub iconOf.
  const DocIcon = resolveDocTypeIcon(docTypeIcon?.(d.type))
  const displayName = d.name ?? d.file_name ?? ''
  // Added by whom + when (shown when the backend provides them) + the expiry chip.
  const by = (typeof d.uploaded_by === 'object' ? d.uploaded_by?.name : d.uploaded_by)
    ?? (typeof d.created_by === 'object' ? d.created_by?.name : d.created_by) ?? ''
  const when = d.uploaded_at ?? d.created_at
  const expiry = computeDocExpiry(d.expires_at)
  // DOC-LIST-LINK-1: the linked kind's own icon + its grouped "<Group> · <label>" tooltip.
  const LinkKindIcon = linked ? LINK_KIND_ICON[linked.kind] : null
  const linkedTooltip = linked ? t('documents.linkedTo', { name: `${t(LINK_KIND_SECTION_KEY[linked.kind])} · ${linked.label}` }) : undefined

  return (
    <div style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
      {/* Row checkbox — disabled while the doc has no downloadable url yet (pending upload). */}
      <input type="checkbox" aria-label={t('documents.selectOne', { name: displayName })}
        checked={downloadable && selected} disabled={!downloadable} onChange={onToggleSelect}
        style={{ accentColor: 'var(--color-primary)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: docColor(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocIcon size={13} color="white" /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renaming
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <input autoFocus value={renameValue} onChange={e => onRenameChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel() }}
                  onBlur={onRenameCommit}
                  style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                {/* Extension shown but not editable. */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{splitExt(displayName).ext}</span>
              </div>
            : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
          }
          {(by || when || expiry || linked || linking) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {(by || when) && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {by}{by && when ? ' · ' : ''}{when ? formatDate(when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>}
              {expiry && (
                <SoftChip size={10}
                  color={expiry.kind === 'expired' ? 'var(--color-danger)' : 'var(--color-warning)'}
                  label={expiry.kind === 'expired'
                    ? t('documents.expiredOn', { date: formatDate(d.expires_at as string) })
                    : t('documents.expiresOn', { date: formatDate(d.expires_at as string) })}
                />
              )}
              {/* DOC-LIST-LINK-1: the linked record's own label + a kind icon (point 1) —
                  swaps for the inline "Koppelen aan" picker while re-linking (point 2).
                  No link and not editing = nothing renders here (never an empty chip). */}
              {linking
                ? <DocumentLinkPicker ariaLabel={t('documents.linkToFor', { name: displayName })} value={linkValue} onChange={onLinkChange}
                    educations={educations} certifications={certifications} languages={languages} skills={skills} references={references} />
                : linked && LinkKindIcon && (
                    <SoftChip size={10} color="var(--color-info)" title={linkedTooltip}
                      label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><LinkKindIcon size={10} aria-hidden="true" />{linked.label}</span>} />
                  )
              }
            </div>
          )}
          {/* DOC-VERSIE-1 point 3: the collapsible "N previous versions" list. */}
          <DocumentVersionHistory versions={d.versions ?? []} />
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: docColor(d.type) + '18', color: docColor(d.type), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>{d.size ?? ''}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
        <div style={{ display: 'flex' }}>
          {/* Point 4: rename/replace/delete are MANAGE actions — never offered without it. */}
          {canManage && <button aria-label={t('common:edit')} onClick={onRenameStart} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>}
          {/* DOC-LIST-LINK-1: change/clear the link — a MANAGE action, only offered once
              the doc is persisted (a temp upload row has no id a PATCH could reference)
              and the candidate actually has something to link to (no fake affordance). */}
          {canManage && isPersisted(d.id) && canLink && (
            <button aria-label={t('documents.changeLink')} title={t('documents.changeLink')} aria-pressed={linking} onClick={onLinkToggle}
              style={{ background: linking ? 'color-mix(in srgb, var(--color-info) 14%, transparent)' : 'none', border: 'none', borderRadius: 4, cursor: 'pointer', color: linking ? 'var(--color-info)' : 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}>
              <Link2 size={12} />
            </button>
          )}
          {canManage && canReplace && isPersisted(d.id) && (
            <button aria-label={t('documents.replace')} title={t('documents.replace')} onClick={onReplace}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><RefreshCw size={12} /></button>
          )}
          <button aria-label={t('documents.preview')} onClick={onPreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
          {/* PDF-VACATURES-26: a real per-row download (read action, no permission
              gate — mirrors the preview button above), next to the bulk "download
              selected" action in the toolbar. Renders only once the row actually
              carries a url; a downloadable=false row (still-uploading optimistic
              row) shows no dead link. */}
          {downloadable && <a href={docUrl(d)} download={displayName} aria-label={t('documents.download')} title={t('documents.download')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Download size={12} /></a>}
          {canManage && <button aria-label={t('common:remove')} onClick={onDeleteRequest} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>}
        </div>
      </div>
    </div>
  )
}
