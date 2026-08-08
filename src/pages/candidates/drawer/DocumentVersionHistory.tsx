import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

// DOC-VERSIE-1: one superseded file snapshot, created on every /replace — the old
// file stays on disk and is reachable through its own authenticated download route.
export interface DocVersion {
  id: Id
  file_size?: string | number
  replaced_by_name?: string | null
  created_at?: string
  download_url?: string
}

/**
 * DocumentVersionHistory — the collapsible "N previous versions" list under a
 * document row (point 3 of the documents punchlist). Split out of
 * DocumentsSection (§3 size discipline): purely presentational, all data comes
 * from props, and the expand/collapse toggle is local UI state that never needs
 * lifting to the parent. Renders nothing for a document with no superseded
 * versions yet — no fake affordance for an empty history.
 */
export default function DocumentVersionHistory({ versions }: { versions: DocVersion[] }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [expanded, setExpanded] = useState(false)
  if (versions.length === 0) return null
  return (
    <div style={{ marginTop: 2 }}>
      <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
        style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, fontSize: 10, color: 'var(--text-muted)' }}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {t('documents.versionCount', { count: versions.length })}
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, paddingLeft: 14, borderLeft: '2px solid var(--border)' }}>
          {versions.map(v => (
            <div key={String(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{v.created_at ? formatDate(v.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              {v.replaced_by_name && <span>· {v.replaced_by_name}</span>}
              {v.file_size != null && <span>· {v.file_size}</span>}
              {v.download_url && (
                <a href={v.download_url} download rel="noopener noreferrer" aria-label={t('documents.downloadVersion')}
                  style={{ display: 'flex', color: 'var(--color-primary-text)' }}>
                  <Download size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
