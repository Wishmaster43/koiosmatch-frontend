/**
 * AiTransparencySettings (X-32) — Settings → AI → AI transparency: the five EU AI-Act
 * principles (backend DECISIONS.md O-17), the human oversight commitment, this tenant's
 * real posture (derived server-side from the Koios mode default) and which Koios
 * features are active — all read-only from GET /ai/transparency-info (no permission
 * gate); the copy per principle key is owned here under `aiAct.principles.<key>`.
 *
 * Row 21 (Danny 09-09, "Ik kan niets instellen??????"): the two AI retention windows
 * are editable here, through the same /settings form path every settings section
 * uses — `ai_prompt_log_retention_days` (read-clamped by PruneAiPromptLogs; the
 * catalogue landing pins 1..3650) and `koios_conversation_memory_days` (SettingSchema
 * int 0..365, zero = no memory; KoiosConversationAssistController::transcript).
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCard, SettingCardList, SettingRow, NumberField } from '../components/SettingsKit'
import { SectionTitle, BodyText, Caption } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'

// The five principle keys the endpoint returns, in display order (copy lives in i18n).
const PRINCIPLE_KEYS = [
  'wizard_is_default',
  'no_automatic_selection_decisions',
  'every_action_is_a_logged_workflow',
  'ai_output_is_labeled',
  'toggles_never_disable_obligations',
] as const

// The three feature rows the endpoint always reports (inactive rather than omitted).
const FEATURE_KEYS = ['koios_chat', 'ai_agent_interviews', 'ai_workflow_steps'] as const

// Tenant defaults = today's reader behaviour: prompt log 90 days (config
// koios_ai.prompt_log_retention_days), conversation memory unset = no day bound.
const RETENTION_DEFAULTS = { ai_prompt_log_retention_days: 90, koios_conversation_memory_days: 0 }
const PROMPT_LOG_RANGE = { min: 1, max: 3650 }
const MEMORY_RANGE = { min: 0, max: 365 }

interface TransparencyInfo {
  principles: string[]
  human_oversight_selection_decisions: boolean
  tenant_posture: { mode_default: 'wizard' | 'auto'; auto_messages: boolean }
  features: Array<{ key: string; active: boolean }>
}

// GET /ai/transparency-info — read-only, cached for the session (the posture rarely changes).
function useTransparencyInfo() {
  return useQuery({
    queryKey: ['ai', 'transparency-info'],
    queryFn: async () => (await api.get<TransparencyInfo>('/ai/transparency-info')).data,
    staleTime: 5 * 60_000,
  })
}

/** AI-Act transparency page: read-only principles, oversight, posture and features, plus the two editable AI retention windows. */
export default function AiTransparencySettings() {
  const { t } = useTranslation('settings')
  const { data, isLoading, isError } = useTransparencyInfo()
  const form = useSettingsForm(RETENTION_DEFAULTS)
  // One scaffold state for both sources: the page loads when either is still loading,
  // and a failed load on either side blocks Save (the retention draft must never
  // overwrite an unknown tenant policy, §8).
  const scaffoldForm = { ...form, loading: isLoading || form.loading, loadError: isError || form.loadError }

  return (
    <SettingsScaffold title={t('aiAct.title')} subtitle={t('aiAct.subtitle')} maxWidth={720} form={scaffoldForm}>
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* The principles: one calm card each, title + one paragraph. */}
          <SettingCardList>
            {PRINCIPLE_KEYS.map(key => (
              <SettingCard key={key}>
                <SectionTitle>{t(`aiAct.principles.${key}.title`)}</SectionTitle>
                <BodyText style={{ marginTop: 6 }}>{t(`aiAct.principles.${key}.body`)}</BodyText>
              </SettingCard>
            ))}
          </SettingCardList>

          {/* Oversight + this tenant's posture, as read-only label/value rows. */}
          <div>
            <SectionTitle style={{ marginBottom: 8 }}>{t('aiAct.tenantPosture.title')}</SectionTitle>
            <SettingCardList>
              <SettingRow label={t('aiAct.humanOversight')}>
                <Caption>{t('aiAct.humanOversightValue')}</Caption>
              </SettingRow>
              <SettingRow label={t('aiAct.tenantPosture.defaultMode.label')}>
                <Caption>{t(`aiAct.tenantPosture.defaultMode.${data.tenant_posture.mode_default === 'auto' ? 'auto' : 'wizard'}`)}</Caption>
              </SettingRow>
              <SettingRow label={t('aiAct.tenantPosture.autoMessages.label')}>
                <Caption>{data.tenant_posture.auto_messages ? t('common:yes') : t('common:no')}</Caption>
              </SettingRow>
            </SettingCardList>
          </div>

          {/* The two AI retention windows (row 21) — the kit NumberField clamps to the
              backend range and says so (field.maxNotice), never a silent cut-off. */}
          <div>
            <SectionTitle style={{ marginBottom: 8 }}>{t('aiAct.retention.title')}</SectionTitle>
            <SettingCardList>
              <SettingRow label={t('aiAct.retention.promptLog.label')} description={t('aiAct.retention.promptLog.description')}>
                <NumberField value={form.values.ai_prompt_log_retention_days} min={PROMPT_LOG_RANGE.min} max={PROMPT_LOG_RANGE.max}
                  onChange={v => form.set('ai_prompt_log_retention_days', v)} unit={t('aiAct.retention.unit')}
                  ariaLabel={t('aiAct.retention.promptLog.label')} />
              </SettingRow>
              <SettingRow label={t('aiAct.retention.conversationMemory.label')} description={t('aiAct.retention.conversationMemory.description')}>
                <NumberField value={form.values.koios_conversation_memory_days} min={MEMORY_RANGE.min} max={MEMORY_RANGE.max}
                  onChange={v => form.set('koios_conversation_memory_days', v)} unit={t('aiAct.retention.unit')}
                  ariaLabel={t('aiAct.retention.conversationMemory.label')} />
              </SettingRow>
            </SettingCardList>
          </div>

          {/* Which Koios features this tenant has on — a chip per feature, colour + text. */}
          <div>
            <SectionTitle style={{ marginBottom: 8 }}>{t('aiAct.features.title')}</SectionTitle>
            <SettingCardList>
              {FEATURE_KEYS.map(key => {
                const active = data.features.find(f => f.key === key)?.active === true
                return (
                  <SettingRow key={key} label={t(`aiAct.features.${key}`)}>
                    <SoftChip label={active ? t('aiAct.features.active') : t('aiAct.features.inactive')}
                      color={active ? 'var(--color-success)' : 'var(--text-muted)'} />
                  </SettingRow>
                )
              })}
            </SettingCardList>
          </div>
        </div>
      )}
    </SettingsScaffold>
  )
}
