/**
 * TaskDescriptionPopout — TAKEN 2 (walkthrough 21-08): the task description
 * on a second screen, the exact TEKST-POPOUT-1 recipe MatchTextPopout /
 * VacancyDescriptionPopout use, applied to `Task.description`. Thin container
 * (§3): identity from useTaskTextLite, draft/sync from useTextPopoutDraft,
 * persistence from patchTaskText — the SAME PATCH /tasks/{id} the drawer's
 * own DetailsTab writes.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell, TextPopoutEditor, useTextPopoutDraft } from '@/pages/popout/shared'
import { useTaskTextLite, patchTaskText } from '../hooks/useTaskTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function TaskDescriptionPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('tasks')
  const { task, loading, error, reload } = useTaskTextLite(id)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchTaskText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('task', id ?? '', 'description'),
    storedValue: task?.description,
    onSave: persist,
  })

  // Window title while this popout is open (mirrors the sibling popouts).
  useEffect(() => {
    if (!task) return
    const previous = document.title
    document.title = t('popout.textWindowTitle', { name: task.title })
    return () => { document.title = previous }
  }, [task, t])

  return (
    <PopoutShell
      loading={loading} error={error || !task} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={task?.title ?? ''} initials={task?.initials ?? ''} subtitle={t('details.description')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty} />
    </PopoutShell>
  )
}
