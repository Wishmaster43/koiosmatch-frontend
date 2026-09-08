/**
 * AgentSessionsTab — the match's AI interview sessions (via application or
 * candidate). Four UI states: loading, error, empty, success. Success shows
 * one InterviewStatusCard per session (read-only, no applicationId), with
 * pause/resume controls for sessions linked to a conversation.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Caption } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { useAgentSessionControl } from '@/hooks/useAgentSessionControl'
import { InterviewStatusCard } from '@/pages/applications/shared'
import { useMatchAgentSessions } from '../hooks/useMatchAgentSessions'
import type { MatchRow } from '@/types/match'

export default function AgentSessionsTab({ match }: { match: MatchRow }) {
  const { t } = useTranslation('matches')
  const auth = useAuth()
  const { sessions, loading, error, empty, refetch } = useMatchAgentSessions(match.id)
  const [confirmPauseConversationId, setConfirmPauseConversationId] = useState<string | number | null>(null)

  // Gate controls on the WhatsApp page permission (CMFE-MEET-1).
  const canControl = auth?.hasPermission?.('page.whatsapp') ?? false

  // Pause/resume hook for each session (shares the same refetch handler).
  const { busy, run } = useAgentSessionControl(refetch, t('agentSessions.controlFailed'))

  // Loading state.
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
        <Spinner size={14} /> {t('agentSessions.loading')}
      </div>
    )
  }

  // Error state.
  if (error) {
    return (
      <Caption as="div" style={{ padding: '24px 0' }}>
        {t('agentSessions.loadError')}
      </Caption>
    )
  }

  // Empty state.
  if (empty) {
    return (
      <Caption as="div" style={{ padding: '24px 0' }}>
        {t('agentSessions.empty')}
      </Caption>
    )
  }

  // Success: show subhead if direct match (no application).
  const isDirect = match.applicationId == null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isDirect && (
        <Caption as="div" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
          {t('agentSessions.viaCandidate')}
        </Caption>
      )}

      {sessions.map((session, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Read-only interview status card (no applicationId prop). */}
          <InterviewStatusCard interview={session.interview} />

          {/* Pause/resume controls when conversation is linked. */}
          {session.conversationId && canControl && session.interview?.category && (
            <div style={{ display: 'flex', gap: 8 }}>
              {session.interview.category === 'busy' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmPauseConversationId(session.conversationId)}
                  disabled={busy != null}
                  aria-label={t('agentSessions.pause')}
                >
                  <Pause size={12} /> {t('agentSessions.pause')}
                </Button>
              )}
              {session.interview.category === 'paused' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void run(String(session.conversationId), 'resume')}
                  disabled={busy != null}
                  aria-label={t('agentSessions.resume')}
                >
                  {busy === 'resume' ? <Spinner size={12} /> : <Play size={12} />} {t('agentSessions.resume')}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Pause confirmation dialog. */}
      <ConfirmDialog
        open={confirmPauseConversationId != null}
        title={t('agentSessions.pauseConfirmTitle')}
        message={t('agentSessions.pauseConfirm')}
        confirmLabel={t('agentSessions.pauseConfirmAction')}
        onCancel={() => setConfirmPauseConversationId(null)}
        onConfirm={async () => {
          if (confirmPauseConversationId) {
            await run(String(confirmPauseConversationId), 'pause')
          }
          setConfirmPauseConversationId(null)
        }}
      />
    </div>
  )
}
