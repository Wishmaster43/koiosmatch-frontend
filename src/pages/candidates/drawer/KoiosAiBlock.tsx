/** AI advisory block for the candidate profile — thin wrapper around the shared
 *  KoiosAdviceBlock (§3A). Resolves the SAME advice the table's "Koios" column
 *  shows (useCandidateAdvice) and builds the profile-level insights (advice +
 *  completeness + engagement) for the shared card. */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useCandidateAdvice } from '@/lib/useCandidateAdvice'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildCandidateAdviceInsights } from './candidateAiInsights'
import type { Candidate } from '@/types/candidate'

// Candidate drawer's Koios AI tab: see the module doc comment above for why it
// resolves the same advice the table column shows.
export default function KoiosAiBlock({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const resolveAdvice = useCandidateAdvice()
  const insights = buildCandidateAdviceInsights(c, t, formatDate, resolveAdvice(c))
  return <KoiosAdviceBlock namespace="candidates" insights={insights} />
}
