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
import { GroupLabel } from '@/components/ui/typography'
import { useTextPopoutSync } from '@/hooks/useTextPopoutSync'
import { textPopoutTopic } from '@/lib/secondScreen'

// See the file's top doc above; mirrors the draft over the shared channel and never offers its own save, since the real persistence is the opener form submit.
export default function MatchRemarksPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('candidates')
  const [text, setText] = useState('')

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

  // No candidate id yet (opened before one was picked) — an honest notice
  // instead of a silently non-functional editor (§3).
  if (!id) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        {t('common:popout.unknownEntity')}
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
