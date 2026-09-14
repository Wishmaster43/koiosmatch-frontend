/**
 * CapModeEditorRow — the ONE cap+mode editor line shared by AdminLimitsTable
 * (platform defaults) and TenantLimitsDrawer (per-tenant overrides): a cap
 * NumberInput (blank = no/inherited limit), the signal/queue/block mode picker
 * and the save action. Extracted so the two admin surfaces share one editor
 * instead of two copies drifting apart.
 */
import { useTranslation } from 'react-i18next'
import NumberInput from '@/components/ui/NumberInput'
import SelectMenu from '@/components/ui/SelectMenu'
import SaveButton from '@/components/ui/SaveButton'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import type { LimitMode } from './limitsApi'
import { LIMIT_MODES, limitModeLabel } from './limitModeLabel'
import type { CapModeDraft } from './useCapModeSave'

interface Props {
  draft: CapModeDraft
  onChange: (draft: CapModeDraft) => void
  capAriaLabel: string
  capPlaceholder?: string
  dirty: boolean
  saved: boolean
  saving: boolean
  error?: string | null
  // opencage/geocode_search's mode is fixed to 'block' server-side (contract §2 point
  // 2) — a picker whose PUT always 422s is a fake affordance, so it renders read-only.
  modeFixed?: boolean
  onSave: () => void
}

export default function CapModeEditorRow({ draft, onChange, capAriaLabel, capPlaceholder, dirty, saved, saving, error, modeFixed, onSave }: Props) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <NumberInput value={draft.cap} onChange={(v) => onChange({ ...draft, cap: v })} min={0}
          placeholder={capPlaceholder} ariaLabel={capAriaLabel} width={110} />
        {modeFixed ? (
          <Caption as="span">{limitModeLabel(t, draft.mode)}</Caption>
        ) : (
          // DROPDOWN-CLEAR-1: mode is required in the PUT body; an empty value would
          // persist a limit row without behaviour, so this picker never clears to blank.
          <SelectMenu value={draft.mode} onChange={(v) => onChange({ ...draft, mode: v as LimitMode })}
            options={LIMIT_MODES.map(m => ({ value: m, label: limitModeLabel(t, m) }))} clearable={false} menuWidth={160} />
        )}
        <SaveButton saved={saved} saving={saving} disabled={!dirty && !saved} size="sm" onClick={onSave} />
      </div>
      {error && <ErrorBanner variant="subtle">{error}</ErrorBanner>}
    </div>
  )
}
