/**
 * StageWindowMapField — the per-application-stage staleness override table
 * (STAGE-STALE-PER-PHASE-1, Danny 29-09: "Intake 3 dagen, voorgesteld 2 werkdagen,
 * dus dit moeten we kunnen definiëren"). One row per tenant application stage, each
 * with its own amount + unit; a stage with no override falls back to the tenant's
 * single `application_stage_stale_days`(+`_unit`) window. Persists the WHOLE map as
 * one JSON string under `application_stage_stale_by_phase` (self-contained — reads/
 * writes the settings store directly), so it renders identically whether mounted
 * from the generic catalogue renderer (`format: 'stage_window_map'`, SchemaSection)
 * or directly on the Koios-advice Thresholds tab.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import {
  useAllSettings, useSettingsLoaded, getJsonSetting, getNumberSetting, getStringSetting,
  saveSettingsKeys, invalidateAllSettingsCache,
} from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { NumberField, SelectField } from './SettingsKit'
import { WINDOW_UNIT_OPTIONS } from './windowUnitOptions'
import { GroupLabel, Caption, BodyText } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import {
  APPLICATION_STAGE_STALE_DAYS_KEY, APPLICATION_STAGE_STALE_DAYS_UNIT_KEY, APPLICATION_STAGE_STALE_BY_PHASE_KEY,
} from '../sections/koiosAdviceKeys'

// One stage's override entry: amount + unit. A stage absent from the map has no override.
interface StageEntry { amount: number; unit: string }
type StageMap = Record<string, StageEntry>

export interface StageWindowMapFieldProps { disabled?: boolean }

export default function StageWindowMapField({ disabled = false }: StageWindowMapFieldProps) {
  const { t } = useTranslation('settings')
  const { stages } = useApplicationStages()
  const settings = useAllSettings()
  const loaded = useSettingsLoaded()
  const map = getJsonSetting<StageMap>(settings, APPLICATION_STAGE_STALE_BY_PHASE_KEY, {})
  const fallbackAmount = getNumberSetting(settings, APPLICATION_STAGE_STALE_DAYS_KEY, 14)
  const fallbackUnit = getStringSetting(settings, APPLICATION_STAGE_STALE_DAYS_UNIT_KEY, 'days') ?? 'days'
  const unitOptions = WINDOW_UNIT_OPTIONS.map(o => ({ value: o.value, label: t(o.label) }))
  // A failed save never touches `map` (it stays the last-confirmed value), but the
  // NumberField already shows the user's blurred keystroke text locally — bump this
  // per-stage counter to remount that field on failure, so its display resets to the
  // last-confirmed `amount` instead of quietly keeping the rejected edit on screen.
  const [revertGen, setRevertGen] = useState<Record<string, number>>({})

  // Persist the whole map as ONE JSON string, optimistic with revert + toast on failure
  // (ADVICE-UNIT-FEEDBACK-1 pattern — a rejected write is said, never swallowed).
  const persist = async (stageKey: string, next: StageMap) => {
    if (!loaded) return
    try {
      await saveSettingsKeys({ [APPLICATION_STAGE_STALE_BY_PHASE_KEY]: next })
      invalidateAllSettingsCache()
    } catch (err) {
      setRevertGen(g => ({ ...g, [stageKey]: (g[stageKey] ?? 0) + 1 }))
      notifyError(extractApiError(err, t('koiosAdvice.byPhaseSaveFailed')))
    }
  }

  // Commit-on-blur, not per-keystroke (NumberField's onCommit fires once, on blur,
  // with the clamped final value) — a bare onChange fired on every key, including
  // the empty-field 0 the BE rejects with a 422. A null commit (input cleared then
  // blurred) resets the stage to the fallback instead of persisting 0.
  const setAmount = (stageKey: string, amount: number | null) => {
    const entry = map[stageKey] ?? { amount: fallbackAmount, unit: fallbackUnit }
    if (amount === null) { reset(stageKey); return }
    if (amount === entry.amount) return
    void persist(stageKey, { ...map, [stageKey]: { ...entry, amount } })
  }
  const setUnit = (stageKey: string, unit: string) => {
    const entry = map[stageKey] ?? { amount: fallbackAmount, unit: fallbackUnit }
    void persist(stageKey, { ...map, [stageKey]: { ...entry, unit } })
  }
  const reset = (stageKey: string) => {
    const next = { ...map }
    delete next[stageKey]
    void persist(stageKey, next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <GroupLabel style={{ marginBottom: 4 }}>{t('koiosAdvice.byPhaseTitle')}</GroupLabel>
      <Caption style={{ marginBottom: 8 }}>{t('koiosAdvice.byPhaseHint')}</Caption>
      {stages.map(stage => {
        const entry = map[stage.value]
        const amount = entry?.amount ?? fallbackAmount
        const unit = entry?.unit ?? fallbackUnit
        return (
          <div key={stage.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <BodyText style={{ flex: 1 }}>{stage.label}</BodyText>
            {/* Commit-on-blur only: onChange fires per keystroke with the raw (unclamped,
                possibly null) value — persisting THAT would POST 0 on every clear and
                POST twice per edit. onCommit fires once, on blur, with the final clamped
                value (or null when the field was emptied). */}
            <NumberField key={`${stage.value}-${revertGen[stage.value] ?? 0}`} value={amount} onChange={() => {}}
              onCommit={n => setAmount(stage.value, n)} min={1} max={365}
              ariaLabel={`${stage.label} ${t('koiosAdvice.byPhaseTitle')}`} disabled={disabled || !loaded} width={72} />
            {/* DROPDOWN-CLEAR-1: the unit pairs with a required amount and must never persist empty. */}
            <SelectField value={unit} onChange={v => setUnit(stage.value, v)} options={unitOptions}
              ariaLabel={`${stage.label} ${t('settings.windows.application_stage_stale_days_unit.label')}`}
              disabled={disabled || !loaded} clearable={false} />
            {entry ? (
              <Button variant="ghost" size="sm" type="button" onClick={() => reset(stage.value)} disabled={disabled || !loaded}>
                {t('koiosAdvice.byPhaseReset')}
              </Button>
            ) : (
              <Caption style={{ minWidth: 130 }}>
                {t('koiosAdvice.byPhaseDefault', { amount: fallbackAmount, unit: t(`settings.options.window_unit.${fallbackUnit}`) })}
              </Caption>
            )}
          </div>
        )
      })}
    </div>
  )
}
