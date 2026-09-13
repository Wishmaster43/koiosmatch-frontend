import { Edit2, Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'

interface InlineEditActionsProps {
  editing: boolean
  onSave: () => void
  onCancel: () => void
  onStartEdit: () => void
}

// The ONE in-place edit toggle (§3A / §3): pencil → diskette + ✕, the shared action-row
// pattern repeated on every card/section that edits in place. Renders nothing more than
// the three icon buttons — the caller still decides whether to show it at all (e.g. only
// when a permission/handler is present).
export function InlineEditActions({ editing, onSave, onCancel, onStartEdit }: InlineEditActionsProps) {
  // Cross-namespace key (no hook namespace needed) — matches every call site's own
  // previous `t('common:save')`-style lookup, whatever that page's default namespace is.
  const { t } = useTranslation()
  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <Button variant="primary" iconOnly size="sm" onClick={onSave} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
        <Button variant="secondary" iconOnly size="sm" onClick={onCancel} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
      </div>
    )
  }
  return (
    <Button variant="ghost" iconOnly size="sm" onClick={onStartEdit} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
  )
}
