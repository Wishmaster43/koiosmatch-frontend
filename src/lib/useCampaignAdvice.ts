import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { deriveCampaignAdvice } from '@/pages/outreach/data/campaignAdvice'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Campaign } from '@/pages/outreach/hooks/useOutreachCampaigns'

/**
 * useCampaignAdvice — the ONE resolver both the outreach (bellijsten) TABLE
 * column and the drawer's Koios block call, so they can never disagree
 * (KOIOS-ADVIES-OVERAL-1, mirrors useCandidateAdvice). Composes the shared
 * rule engine (campaignAdvice.ts): an active campaign with nothing to
 * call/mail/message, or a stale draft that never activated.
 */
export function useCampaignAdvice(): (c: Campaign) => KoiosAdvice | null {
  const { t } = useTranslation('outreach')

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((c: Campaign): KoiosAdvice | null => {
    const rule = deriveCampaignAdvice(c)
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.attention', { defaultValue: 'Attention' }),
      reason: t(rule.reasonKey, { defaultValue: 'This campaign needs a look.' }),
      source: 'rules',
    }
  }, [t])
}
