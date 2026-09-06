/** AI advisory block for the candidate profile — thin wrapper around the shared
 *  KoiosAdviceBlock (§3A). Resolves the SAME advice the table's "Koios" column
 *  shows (useCandidateAdvice) and builds the profile-level insights (advice +
 *  completeness + engagement) for the shared card. */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useAuth } from '@/context/AuthContext'
import { useCandidateAdvice } from '@/lib/useCandidateAdvice'
import { useKoiosAdviceRun } from '@/lib/useKoiosAdviceRun'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildCandidateAdviceInsights } from './candidateAiInsights'
import type { Candidate } from '@/types/candidate'

// Candidate drawer's Koios AI tab: see the module doc comment above for why it
// resolves the same advice the table column shows. The block includes a context ref
// so clicking an advice row opens the Koios chat with this candidate as context.
export default function KoiosAiBlock({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const resolveAdvice = useCandidateAdvice()
  const insights = buildCandidateAdviceInsights(c, t, formatDate, resolveAdvice(c))

  // S1 K-266/K-267: the "Advies vernieuwen" button is gated on candidates.update
  // AND the koios_ai module (EnsureTenantModule on the route — a Core tenant
  // with only koios_assist gets a 403, so the button must not even render for
  // it; mirrors WhatsAppPage's plain hasModule gate) and starts a REAL AI call
  // (API-CREDITS-1).
  const auth = useAuth()
  const canUpdate = (auth?.hasPermission?.('candidates.update') ?? false) && (auth?.hasModule?.('koios_ai') ?? false)
  // freshAdvice + the run's own pending/notice live in the hook's module-scope
  // store (S1 repair NOTE 3), keyed by the candidate id, so a paid run survives
  // a tab switch; `c.koiosAiAdvice.runId` lets the hook drop a stale local
  // override once a bulk/workflow refetch brings a genuinely newer one.
  const { request, pending, notice, freshAdvice } = useKoiosAdviceRun('candidates', c.id, c.koiosAiAdvice?.runId)

  return <KoiosAdviceBlock
    namespace="candidates"
    insights={insights}
    contextRef={c.id ? { type: 'candidate', id: String(c.id), label: c.name ?? '' } : undefined}
    aiAdvice={freshAdvice !== undefined ? freshAdvice : c.koiosAiAdvice}
    onRequestAdvice={canUpdate ? request : undefined}
    advicePending={pending}
    adviceNotice={notice}
  />
}
