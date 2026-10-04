/**
 * AssistDeclinedFace — the shared "declined" face for one Koios action item
 * (CLAIM-1, 03-10): the server rejected a duplicate application_propose
 * inside its own dedupe window — and, since KOIOS-DEDUPE-1, a `duplicate_*`
 * decline from any create/schedule tool whose natural-key twin already
 * exists. Shows the reason by machine `code` (with the server's own `reason`
 * as a title tooltip and the unknown-code fallback text — never a blank
 * caption), a chip to the existing proposal/record when the item carries
 * enough to link it, and (proposal codes ONLY — a duplicate has no force
 * path) a "Toch versturen" force-send button. Extracted once (§16
 * CLONE-BY-CONSTRUCTION-1) because AssistActionItemCard and NoteActionsPanel
 * both render this exact face — reuse it here, never re-derive it ad hoc.
 */
import { ShieldAlert, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from './../Button'
import Spinner from './../Spinner'
import { Caption } from './../typography'
import { buildEntityDeepLink } from './../EntityLink'
import { pageForResultRef } from '@/components/layout/koios/koiosResultLinks'
import type { Id } from '@/types/common'

// A duplicate decline's machine code is `duplicate_<entity>` (optionally
// `_archived`) — any other known code is the pre-existing proposal vocabulary.
const isDuplicateCode = (code?: string | null) => !!code && code.startsWith('duplicate_')

interface AssistDeclinedFaceProps {
  // Widened from the proposal-only union (KOIOS-DEDUPE-1): a `duplicate_*`
  // code from any create/schedule tool, or an older/unmapped server string.
  code?: string | null
  reason?: string
  applicationId?: Id | null
  proposalId?: Id | null
  // KOIOS-DEDUPE-1: the existing record a duplicate decline collided with —
  // present only when the confirming user holds that record's view
  // permission (absent, never a dead chip).
  existingRef?: { type: string; id: Id; archived?: boolean } | null
  confirming?: boolean
  onForceSend: () => void
}

// Renders the declined reason (by code, server reason as fallback/tooltip), an existing-proposal/record chip when linkable, and (proposal codes only) the force-send button.
export default function AssistDeclinedFace({ code, reason, applicationId, proposalId, existingRef, confirming, onForceSend }: AssistDeclinedFaceProps) {
  const { t } = useTranslation('common')
  const duplicate = isDuplicateCode(code)
  const label = code === 'proposal_in_flight'
    ? t('notesAssist.execute.declined.proposal_in_flight')
    : code === 'proposal_recently_sent'
      ? t('notesAssist.execute.declined.proposal_recently_sent')
      : duplicate
        ? (code!.endsWith('_archived')
          ? t('notesAssist.execute.declined.duplicate_archived')
          : t('notesAssist.execute.declined.duplicate'))
        : (reason ?? t('notesAssist.execute.forbidden', { defaultValue: 'Geen rechten' }))
  // A duplicate's existing-record chip only renders when the ref's type
  // resolves to a real page — same degrade-safely rule as KoiosRefChip.
  const existingPage = existingRef ? pageForResultRef(existingRef.type) : null

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
      {duplicate && existingRef && existingPage && (
        <Button href={buildEntityDeepLink(existingPage, existingRef.id)} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm">
          {t('notesAssist.execute.openExisting')} <ExternalLink size={11} />
        </Button>
      )}
      {/* A duplicate has no force path — only the proposal-collision codes do. */}
      {!duplicate && (
        <Button variant="secondary" size="sm" onClick={onForceSend} disabled={confirming} style={{ flexShrink: 0 }}>
          {confirming ? <Spinner size={12} /> : null} {t('notesAssist.execute.forceSend')}
        </Button>
      )}
    </span>
  )
}
