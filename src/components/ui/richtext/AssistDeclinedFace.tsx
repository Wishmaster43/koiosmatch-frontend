/**
 * AssistDeclinedFace — the shared "declined" face for one Koios action item
 * (CLAIM-1, 03-10): the server rejected a duplicate application_propose
 * inside its own dedupe window. Shows the reason by machine `code` (with the
 * server's own `reason` as a title tooltip and the unknown-code fallback
 * text — never a blank caption), a chip to the existing proposal when the
 * item carries both a `proposalId` AND an application link, and a
 * "Toch versturen" force-send button. Extracted once (§16
 * CLONE-BY-CONSTRUCTION-1) because AssistActionItemCard and NoteActionsPanel
 * both render this exact face — reuse it here, never re-derive it ad hoc.
 */
import { ShieldAlert, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from './../Button'
import Spinner from './../Spinner'
import { Caption } from './../typography'
import { buildEntityDeepLink } from './../EntityLink'
import type { Id } from '@/types/common'

interface AssistDeclinedFaceProps {
  code?: 'proposal_in_flight' | 'proposal_recently_sent' | null
  reason?: string
  applicationId?: Id | null
  proposalId?: Id | null
  confirming?: boolean
  onForceSend: () => void
}

// Renders the declined reason (by code, server reason as fallback/tooltip), an existing-proposal chip when linkable, and the force-send button.
export default function AssistDeclinedFace({ code, reason, applicationId, proposalId, confirming, onForceSend }: AssistDeclinedFaceProps) {
  const { t } = useTranslation('common')
  const label = code === 'proposal_in_flight'
    ? t('notesAssist.execute.declined.proposal_in_flight')
    : code === 'proposal_recently_sent'
      ? t('notesAssist.execute.declined.proposal_recently_sent')
      : (reason ?? t('notesAssist.execute.forbidden', { defaultValue: 'Geen rechten' }))

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Caption as="span" title={reason} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
        <ShieldAlert size={13} /> {label}
      </Caption>
      {proposalId != null && applicationId != null && (
        <Button href={buildEntityDeepLink('applications', applicationId)} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm">
          {t('notesAssist.execute.openProposal')} <ExternalLink size={11} />
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={onForceSend} disabled={confirming} style={{ flexShrink: 0 }}>
        {confirming ? <Spinner size={12} /> : null} {t('notesAssist.execute.forceSend')}
      </Button>
    </span>
  )
}
