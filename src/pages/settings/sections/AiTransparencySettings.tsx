/**
 * AiTransparencySettings (X-32) — Settings → AI → AI transparency: a read-only
 * page with the five EU AI-Act principles (backend DECISIONS.md O-17), the human
 * oversight commitment, this tenant's real posture (derived server-side from the
 * Koios mode default) and which Koios features are active. Data from
 * GET /ai/transparency-info (no permission gate); the copy per principle key is
 * owned here under `aiAct.principles.<key>` (same idiom as the signal catalogue).
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { SettingsScaffold, SettingCard, SettingCardList, SettingRow } from '../components/SettingsKit'
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

/** Read-only AI-Act transparency page: principles, oversight, tenant posture, active features. */
export default function AiTransparencySettings() {
  const { t } = useTranslation('settings')
  const { data, isLoading, isError } = useTransparencyInfo()

  return (
    <SettingsScaffold title={t('aiAct.title')} subtitle={t('aiAct.subtitle')}
      maxWidth={720} form={{ loading: isLoading, loadError: isError }} actions={undefined}>
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
