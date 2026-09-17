/**
 * ApplicationConversationsSection — the application drawer's Gesprekken tab
 * (GESPREK-CONSISTENT-1-FE, Danny 17-09: "we moeten wel consistent zijn met
 * gesprek starten! en waar we de conversatie terug kunnen lezen!"). A
 * conversation belongs to the PERSON (the candidate), never to the
 * application, so this is a thin wrapper mirroring
 * ContactConversationsSection exactly: same start-trigger gate, same shared
 * ConversationsSection, but pointed at the candidate-wide thread list — never
 * filtered down to this one application (a hidden thread is the bug this
 * rule kills). `applicationId` travels forward-compatibly on the start body
 * (StartConversationModal's optional `applicationId` prop; the BE stamps the
 * thread with it only once KLEIN-BE-2 lands, measured absent on api main
 * 4b81fed9) and marks which row belongs to THIS application in the reader
 * (ConversationsSection's `badgeApplicationId`, live: ConversationResource
 * already emits application_id).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { StartConversationModal } from '@/pages/candidates/shared'
import { useCanStartConversation } from '@/hooks/useCanStartConversation'
import { Caption } from '@/components/ui/typography'
import type { Id } from '@/types/common'

export default function ApplicationConversationsSection({ candidateId, candidateMobile, applicationId }: {
  candidateId: Id | null
  // Known false (empty/null) disables the trigger like every other start affordance
  // (§3); unknown (undefined — the Application resource carries no mobile field
  // today, see the lane's `declined`) leaves it enabled and lets the server's own
  // 422 reason surface instead of guessing.
  candidateMobile?: string | null
  // Mirrors Application.id's own type (Id | undefined) — always present in
  // practice on a real drawer, but the field type stays honest.
  applicationId: Id | undefined
}) {
  const { t } = useTranslation('candidates')
  const canStartConversation = useCanStartConversation()
  const [showStartModal, setShowStartModal] = useState(false)
  // Bumped on a successful start so the thread list re-fetches from the server.
  const [refreshKey, setRefreshKey] = useState(0)

  // No candidate at all — nothing to read or start; the honest notice, no request.
  if (candidateId == null) {
    return <Caption style={{ fontStyle: 'italic' }}>{t('applications:interview.conversation.noCandidate')}</Caption>
  }

  const mobileKnownEmpty = candidateMobile === null || candidateMobile === ''

  return (
    <>
      {showStartModal && (
        <StartConversationModal subject={{ kind: 'candidate', id: candidateId }} applicationId={applicationId}
          onClose={() => setShowStartModal(false)} onStarted={() => setRefreshKey(k => k + 1)} />
      )}
      {/* The PERSON's threads — every conversation this candidate has, not just the
          ones this application started (GESPREK-CONSISTENT-1-FE's binding rule). */}
      <ConversationsSection key={refreshKey} threadsUrl="/conversations" threadsParams={{ candidate_id: candidateId }}
        badgeApplicationId={applicationId}
        headerAction={canStartConversation ? (
          <DrawerAddButton onClick={() => setShowStartModal(true)} icon={MessageCircle}
            label={t('conversations.start')} disabled={mobileKnownEmpty}
            title={mobileKnownEmpty ? t('conversations.startNoMobile') : t('conversations.start')} />
        ) : undefined} />
    </>
  )
}
