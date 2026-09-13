// RichTextBlockHeader — the title row shared by every entity's "own free-text
// block" (match text, opportunity description, …): title left, right-aligned
// save/cancel while editing or popout+edit otherwise. Mirrors ProfileTab's own
// header idiom (§3A "every free-text field") without forcing every caller onto
// CollapsibleRichText's collapsed-by-default shape.
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import type { TFunction } from 'i18next'
import Button from './Button'
import { GroupLabel } from './typography'

export function RichTextBlockHeader({ t, title, editing, onSave, onCancel, onStartEdit, onPopout, id }: {
  t: TFunction
  title: React.ReactNode
  editing: boolean
  onSave: () => void
  onCancel: () => void
  onStartEdit: () => void
  onPopout?: () => void
  // Popout button only renders once the record has an id (mirrors both callers'
  // `matchId`/`opportunityId != null` guard).
  id?: unknown
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <GroupLabel>{title}</GroupLabel>
      {editing ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button variant="primary" iconOnly size="sm" onClick={onSave} title={t('common:save')} aria-label={t('common:save')}>
            <Save size={13} />
          </Button>
          <Button variant="secondary" iconOnly size="sm" onClick={onCancel} title={t('common:cancel')} aria-label={t('common:cancel')}>
            <X size={13} />
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {onPopout && id != null && (
            <Button variant="secondary" iconOnly size="sm" onClick={onPopout}
              title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
              <ExternalLink size={13} />
            </Button>
          )}
          <Button variant="secondary" iconOnly size="sm" onClick={onStartEdit} title={t('common:edit')} aria-label={t('common:edit')}>
            <Edit2 size={13} />
          </Button>
        </div>
      )}
    </div>
  )
}
