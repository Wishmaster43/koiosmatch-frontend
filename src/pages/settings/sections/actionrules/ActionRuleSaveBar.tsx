/**
 * ActionRuleSaveBar — the dirty-state bar: how many cells changed locally, "reset
 * everything to default" (confirm-gated, since it can silently discard many edits),
 * and the one Save button that PUTs the staged rows (§ "one save bar (PUT)").
 */
import { useTranslation } from 'react-i18next'
import { Check, Save, RotateCcw } from 'lucide-react'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'

interface ActionRuleSaveBarProps {
  dirtyCount: number
  saving: boolean
  saved: boolean
  onSave: () => void
  onResetAll: () => void
}

// The action-rules dirty-state bar (see file docblock above): staged-change count,
// a confirm-gated reset-to-default, and the one Save button.
export default function ActionRuleSaveBar({ dirtyCount, saving, saved, onSave, onResetAll }: ActionRuleSaveBarProps) {
  const { t } = useTranslation('settings')
  const dirty = dirtyCount > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      {/* Dirty-count indicator — only shown once something is staged, never a false "0". */}
      {dirty && (
        <span style={{ fontSize: 12, color: 'var(--color-primary-text)', fontWeight: 500 }}>
          {t('actionRules.saveBar.dirtyCount', { count: dirtyCount })}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={onResetAll}>
          <RotateCcw size={13} /> {t('actionRules.saveBar.resetAll')}
        </Button>
        {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
        <SaveButton saved={saved} onClick={onSave} disabled={!dirty || saving}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : <><Save size={13} /> {saving ? t('common.saving') : t('common.save')}</>}
        </SaveButton>
      </div>
    </div>
  )
}
