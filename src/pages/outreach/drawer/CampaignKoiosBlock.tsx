import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useCampaignAdvice } from '@/lib/useCampaignAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import type { Campaign } from '../hooks/useOutreachCampaigns'

/** Koios advisory for the outreach (bellijst) drawer — thin wrapper mirroring
 *  the candidate drawer's KoiosAiBlock (§3A). Resolves the SAME advice the
 *  table's Koios column shows (useCampaignAdvice, KOIOS-ADVIES-OVERAL-1) and
 *  renders nothing at all when there is none (no empty shell). Heading copy
 *  comes from the shared common:ai.* block (all five locales). */
export default function CampaignKoiosBlock({ campaign }: { campaign: Campaign }) {
  const resolveAdvice = useCampaignAdvice()
  const insights = adviceInsightRows(resolveAdvice(campaign))
  if (insights.length === 0) return null
  return <KoiosAdviceBlock namespace="common" insights={insights} />
}
