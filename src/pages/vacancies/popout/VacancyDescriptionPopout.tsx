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
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import { useVacancyTextLite, patchVacancyText } from '../hooks/useVacancyTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

// Second-screen editor for the vacancy description (see the module doc above for the shared TEKST-POPOUT-1 recipe); a thin composer of identity/draft/persistence hooks.
export default function VacancyDescriptionPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('vacancies')
  const { vacancy, loading, error, reload } = useVacancyTextLite(id)

  // Stable save function for useTextPopoutDraft: writes through the same PATCH the drawer's DescriptionTab uses, so a save here and a save there never disagree.
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
      {/* VACGEN-1: same generate path as the drawer's own DescriptionTab — both
          now ride RichTextEditor's shared generic assistGenerate, entity
          'vacancy' — one Koios-generate UX everywhere, no bespoke chip. */}
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={id ? { entity: 'vacancy', id } : undefined} />
    </PopoutShell>
  )
}
