/**
 * ActionRuleSaveBar — the dirty-state bar: how many cells changed locally, "reset
 * everything to default" (confirm-gated, since it can silently discard many edits),
 * and the one Save button that PUTs the staged rows (§ "one save bar (PUT)").
 */
import { useTranslation } from 'react-i18next'
import { Check, Save, RotateCcw } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ActionRuleSaveBarProps {
  dirtyCount: number
  saving: boolean
  saved: boolean
  onSave: () => void
  onResetAll: () => void
}

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
        <button type="button" onClick={onSave} disabled={!dirty || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13,
                   fontWeight: 500, borderRadius: 8, border: 'none', cursor: dirty && !saving ? 'pointer' : 'default',
                   whiteSpace: 'nowrap', opacity: dirty || saved ? 1 : 0.5,
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)',
                   // Success fill needs its own on-* token — white only reaches ~3.3:1 there (WCAG audit 2026-08).
                   color: saved ? 'var(--color-on-success)' : 'var(--color-on-accent)' }}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : <><Save size={13} /> {saving ? t('common.saving') : t('common.save')}</>}
        </button>
      </div>
    </div>
  )
}
