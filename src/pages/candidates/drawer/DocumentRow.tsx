import { useTranslation } from 'react-i18next'
import { Pencil, Eye, X, RefreshCw } from 'lucide-react'
import { resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import SoftChip from '@/components/ui/SoftChip'
import DocumentVersionHistory from './DocumentVersionHistory'
import { splitExt, isPersisted, computeDocExpiry, DOC_GRID_COLUMNS } from './documentHelpers'
import type { DocItem } from './documentHelpers'

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
  onPreview: () => void
  onDeleteRequest: () => void
  docColor: (type?: string) => string
  docTypeLabel: (type?: string) => string
  docTypeIcon?: (type?: string) => string | null | undefined
}

/**
 * DocumentRow — one document list row: checkbox, type tile + name (or its inline
 * rename input), the DOC-EXPIRY-1 expiry chip, the DOC-VERSIE-1 version-history
 * toggle, type chip, size, and the row actions. Split out of DocumentsSection
 * (§3 size discipline) — purely presentational, every persistence path lives in
 * the parent; this component only renders props and fires the callbacks it was
 * given.
 */
export default function DocumentRow({
  d, selected, downloadable, onToggleSelect, canManage,
  renaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
  onReplace, onPreview, onDeleteRequest, docColor, docTypeLabel, docTypeIcon,
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
          {(by || when || expiry) && (
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
            </div>
          )}
          {/* DOC-VERSIE-1 point 3: the collapsible "N previous versions" list. */}
          <DocumentVersionHistory versions={d.versions ?? []} />
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: docColor(d.type) + '18', color: docColor(d.type), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
        <div style={{ display: 'flex' }}>
          {/* Point 4: rename/replace/delete are MANAGE actions — never offered without it. */}
          {canManage && <button aria-label={t('common:edit')} onClick={onRenameStart} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>}
          {canManage && isPersisted(d.id) && (
            <button aria-label={t('documents.replace')} title={t('documents.replace')} onClick={onReplace}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><RefreshCw size={12} /></button>
          )}
          <button aria-label={t('documents.preview')} onClick={onPreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
          {canManage && <button aria-label={t('common:remove')} onClick={onDeleteRequest} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>}
        </div>
      </div>
    </div>
  )
}
