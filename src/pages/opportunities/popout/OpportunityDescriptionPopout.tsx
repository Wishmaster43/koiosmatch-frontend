/**
 * OpportunityDescriptionPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): the
 * "Kanstekst" on a second screen, the exact TEKST-POPOUT-1 recipe
 * MatchTextPopout already follows, applied to `description`. Thin container
 * (§3): identity from useOpportunityTextLite, draft/sync from
 * useTextPopoutDraft, persistence from patchOpportunityText — the SAME PATCH
 * /opportunities/{id} the drawer's own OpportunityDescriptionBlock writes.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell, TextPopoutEditor, useTextPopoutDraft } from '@/pages/popout/shared'
import { useOpportunityTextLite, patchOpportunityText } from '../hooks/useOpportunityTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function OpportunityDescriptionPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('opportunities')
  const { opportunity, loading, error, reload } = useOpportunityTextLite(id)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchOpportunityText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('opportunity', id ?? '', 'description'),
    storedValue: opportunity?.description,
    onSave: persist,
  })

  // Window title while this popout is open (mirrors the sibling popouts).
  useEffect(() => {
    if (!opportunity) return
    const previous = document.title
    document.title = t('popout.textWindowTitle', { name: opportunity.title })
    return () => { document.title = previous }
  }, [opportunity, t])

  return (
    <PopoutShell
      loading={loading} error={error || !opportunity} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={opportunity?.title ?? ''} initials={opportunity?.initials ?? ''} subtitle={t('details.groups.description')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty} />
    </PopoutShell>
  )
}
