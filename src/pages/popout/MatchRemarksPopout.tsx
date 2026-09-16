/**
 * MatchRemarksPopout — second-screen editor for the "+Match" Opmerkingen field
 * (batch 5, P34), the candidate drill-down's own useTextPopoutHost recipe
 * (§11: one mechanism) applied to a field that has no server identity of its
 * own yet: a match may not exist as a record until the recruiter submits the
 * form. This window therefore only MIRRORS the draft over the shared
 * BroadcastChannel — same continuous two-way sync ProfileTab's popped-out
 * profile text uses — and never offers its own "save": the real persistence
 * is the match form's own submit in the opener window, so a separate save
 * button here would be a fake affordance (§3).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { GroupLabel, BodyText } from '@/components/ui/typography'
import { useTextPopoutSync } from '@/hooks/useTextPopoutSync'
import { textPopoutTopic } from '@/lib/secondScreen'
import { useCandidateLite } from './hooks/useCandidateLite'

// See the file's top doc above; mirrors the draft over the shared channel and never offers its own save, since the real persistence is the opener form submit.
export default function MatchRemarksPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('candidates')
  const [text, setText] = useState('')
  // Candidate name for the window title — POPOUT-TITLE-1: every pop-out window
  // sets document.title, mirrors CandidateSummaryPopout's own effect below.
  const { candidate } = useCandidateLite(id)

  // Continuous two-way mirror: both windows post 'draft' on every edit and
  // adopt whatever the peer last sent — there is no separate "saved" state
  // for a field that is not independently persisted.
  const post = useTextPopoutSync({
    topic: textPopoutTopic('candidate', id ?? '', 'matchRemarks'),
    enabled: true,
    onMessage: message => { if (message.kind === 'hello') return; setText(message.html) },
  })
  // Announce this window so the opener replays its current draft into it.
  useEffect(() => { post({ kind: 'hello' }) }, [post])
  const change = (html: string) => { setText(html); post({ kind: 'draft', html }) }

  // Window title — "Match remarks: <name>" while this popout is open; restored
  // on unmount so a reused window slot never keeps a stale title.
  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.matchRemarksWindowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  // No candidate id yet (opened before one was picked) — an honest notice
  // instead of a silently non-functional editor (§3).
  if (!id) {
    return (
      // Typography atom (§4): BodyText carries the 13/400 identity, only the muted colour is a caller override.
      <div style={{ padding: 24 }}>
        <BodyText style={{ color: 'var(--text-muted)' }}>{t('common:popout.unknownEntity')}</BodyText>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: 20, gap: 10 }}>
      <GroupLabel>{t('placement.matchRemarks')}</GroupLabel>
      <RichTextEditor value={text} onChange={change} fill minHeight={220} assistModes={['improve', 'summarize', 'actions']} />
    </div>
  )
}
