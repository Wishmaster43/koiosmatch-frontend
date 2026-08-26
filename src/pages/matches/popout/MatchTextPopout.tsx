/**
 * MatchTextPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): de matchtekst op
 * een tweede scherm, het exacte TEKST-POPOUT-1-recept dat CandidateSummary-,
 * CustomerCompanyText- en VacancyDescriptionPopout al volgen, toegepast op
 * `match_text`. Thin container (§3): identity from useMatchTextLite, draft/sync
 * from useTextPopoutDraft, persistence from patchMatchText — the SAME PATCH
 * /matches/{id} the drawer's own MatchTextBlock writes.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell, TextPopoutEditor, useTextPopoutDraft } from '@/pages/popout/shared'
import { useMatchTextLite, patchMatchText } from '../hooks/useMatchTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

// Thin container: the match text on a second screen (TEKST-POPOUT-1 recipe, see
// the module doc comment above) — identity/draft/save are all delegated to shared hooks.
export default function MatchTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('matches')
  const { match, loading, error, reload } = useMatchTextLite(id)

  // Saves through the same PATCH /matches/{id} the drawer's own MatchTextBlock
  // writes, so the popout and the drawer never drift onto two save paths.
  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchMatchText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('match', id ?? '', 'text'),
    storedValue: match?.matchText,
    onSave: persist,
  })

  // Window title while this popout is open (mirrors the sibling popouts).
  useEffect(() => {
    if (!match) return
    const previous = document.title
    document.title = t('popout.textWindowTitle', { name: match.title })
    return () => { document.title = previous }
  }, [match, t])

  return (
    <PopoutShell
      loading={loading} error={error || !match} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={match?.title ?? ''} initials={match?.initials ?? ''} subtitle={t('drawer.matchText.title')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty} />
    </PopoutShell>
  )
}
