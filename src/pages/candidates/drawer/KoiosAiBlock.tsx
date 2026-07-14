import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildCandidateAdviceInsights } from './candidateAiInsights'
import type { Candidate } from '@/types/candidate'

/** AI advisory block for the candidate profile — thin wrapper around the shared
 *  KoiosAdviceBlock (§3A). Builds the profile-level insights (completeness +
 *  engagement) and hands them to the shared card; no visual/behavioural change
 *  from the previous inline implementation. */
export default function KoiosAiBlock({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const insights = buildCandidateAdviceInsights(c, t, formatDate)
  return <KoiosAdviceBlock namespace="candidates" insights={insights} />
}
