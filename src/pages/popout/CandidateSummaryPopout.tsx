/**
 * CandidateSummaryPopout — TEKST-POPOUT-1 (Danny 08-08 punt 2): the candidate's
 * PROFILE TEXT on a second screen. Same second-screen recipe as the notes popout
 * (a real `window.open` on a route rendered outside DashboardLayout, the shared
 * PopoutShell for loading/error/header) — only the content differs: one field
 * instead of a thread.
 *
 * Thin container (§3): identity + stored value come from useCandidateLite, the
 * draft/sync from useTextPopoutDraft, persistence from the candidate drawer's OWN
 * patch path (useCandidateRecord → buildCandidatePatch → PATCH /candidates/{id}),
 * so this window writes the field through exactly the same code the drill-down
 * does — including its centrally translated error message (§10).
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PopoutShell from './PopoutShell'
import TextPopoutEditor from './TextPopoutEditor'
import { useCandidateLite } from './hooks/useCandidateLite'
import { useTextPopoutDraft } from './hooks/useTextPopoutDraft'
import { useCandidateRecord } from '@/pages/candidates/hooks/useCandidateMutations'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function CandidateSummaryPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(id)
  const { patchCandidate } = useCandidateRecord()

  // Persist through the drawer's own patch path; `revert` runs on a rejected
  // write so neither window keeps claiming the text was saved.
  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return
    patchCandidate(id, { summary: html }, revert)
  }, [id, patchCandidate])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('candidate', id ?? '', 'summary'),
    storedValue: candidate?.summary,
    onSave: persist,
  })

  // Window title — "Profieltekst — <name>" while this popout is open; restored on
  // unmount so a reused window slot never keeps a stale title.
  useEffect(() => {
    if (!candidate) return
    const previous = document.title
    document.title = t('popout.summaryWindowTitle', { name: candidate.name })
    return () => { document.title = previous }
  }, [candidate, t])

  return (
    <PopoutShell
      loading={loading} error={error || !candidate} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={candidate?.name ?? ''} initials={candidate?.initials ?? ''} subtitle={t('profile.summary')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty} />
    </PopoutShell>
  )
}
