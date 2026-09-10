/**
 * CustomerDepartmentTextPopout — K5a (batch 5): a department's omschrijving on a
 * second screen. Same recipe as CustomerCompanyTextPopout, one level deeper: the
 * `id` param is the COMPOSITE `<customerId>:<departmentId>` (departmentPopoutId,
 * lib/secondScreen.ts) — there is no standalone GET for one department (K5a
 * ruling), so this window fetches the customer's department LIST and finds the
 * row, and PATCHes the nested route with both ids.
 *
 * KOIOS-GENERATE-1: `generate` wired — 'department' is live in the backend's
 * generate controller and in the shared GenerateEntity type (widened 13-08), so
 * this popout offers Genereer exactly like the customer popout.
 *
 * DRY-POPOUT-1: shared rendering via SharedTextPopoutBody — behaviour unchanged.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import SharedTextPopoutBody from './SharedTextPopoutBody'
// Shared "unknown record" error shell, joined by CustomerContactTextPopout (DRY round 11, CUSTTABS2).
import { unknownRecordPopoutBody } from './unknownRecordPopoutBody'
import { useDepartmentTextLite, patchDepartmentText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic, parseDepartmentPopoutId } from '@/lib/secondScreen'

// Second-screen editor for a department's description, per the composite-id
export default function CustomerDepartmentTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const parsed = parseDepartmentPopoutId(id)
  const { department, loading, error, reload } = useDepartmentTextLite(parsed?.customerId, parsed?.departmentId)

  // Save handler for useTextPopoutDraft below; stable identity so a save in flight
  // isn't retriggered by an unrelated re-render.
  const persist = useCallback((html: string, revert: () => void) => {
    if (!parsed) return Promise.resolve(false)
    return patchDepartmentText(parsed.customerId, parsed.departmentId, html, t, revert)
  }, [parsed, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'departmentText'),
    storedValue: department?.description,
    onSave: persist,
  })

  // Sets the window title to the department name once it loads, restoring the
  // previous title on unmount so a closed popout doesn't leak its title elsewhere.
  useEffect(() => {
    if (!department) return
    const previous = document.title
    document.title = t('popout.departmentTextWindowTitle', { name: department.name })
    return () => { document.title = previous }
  }, [department, t])

  // A malformed/legacy id (no customer+department pair) is an honest "unknown
  // record" state, never a silent wrong fetch (§3).
  if (!parsed) {
    return unknownRecordPopoutBody(t, reload)
  }

  return (
    <SharedTextPopoutBody
      loading={loading} error={error || !department} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={department?.name ?? ''} subtitle={t('departments.detail.description')}
      text={text} dirty={dirty} onChange={change} onSave={save}
      generate={{ entity: 'department', id: parsed.departmentId }}
    />
  )
}
