/**
 * VacancyDescriptionPopout — V-desc-1: the vacancy description on a second
 * screen, the exact TEKST-POPOUT-1 recipe CandidateSummaryPopout /
 * CustomerCompanyTextPopout use, applied to `Vacancy.description`. Thin
 * container (§3): identity from useVacancyTextLite, draft/sync from
 * useTextPopoutDraft, persistence from patchVacancyText — the SAME PATCH
 * /vacancies/{id} the drawer's own DescriptionTab writes.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PopoutShell from '@/pages/popout/PopoutShell'
import TextPopoutEditor from '@/pages/popout/TextPopoutEditor'
import { useTextPopoutDraft } from '@/pages/popout/hooks/useTextPopoutDraft'
import { useVacancyTextLite, patchVacancyText } from '../hooks/useVacancyTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function VacancyDescriptionPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('vacancies')
  const { vacancy, loading, error, reload } = useVacancyTextLite(id)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchVacancyText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('vacancy', id ?? '', 'description'),
    storedValue: vacancy?.description,
    onSave: persist,
  })

  // Window title — "Vacancy text — <title>" while this popout is open (mirrors
  // the candidate profile-text and customer company-text window titles).
  useEffect(() => {
    if (!vacancy) return
    const previous = document.title
    document.title = t('popout.descriptionWindowTitle', { name: vacancy.title })
    return () => { document.title = previous }
  }, [vacancy, t])

  return (
    <PopoutShell
      loading={loading} error={error || !vacancy} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={vacancy?.title ?? ''} initials={vacancy?.initials ?? ''} subtitle={t('details.description')}
    >
      {/* VACGEN-1 mirrors the drawer's own generate path: entity 'vacancy' is
          already known to /ai/koios/generate — same review→Toepassen flow, though
          this popout rides RichTextEditor's own generic assistGenerate (the richer
          VacancyGenerateFlow with its profile-transparency chip stays the drawer's
          own affordance — see TextPopoutEditor's docblock). */}
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={id ? { entity: 'vacancy', id } : undefined} />
    </PopoutShell>
  )
}
