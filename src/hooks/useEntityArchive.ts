/**
 * useEntityArchive — the per-record archive/restore lifecycle shared by every
 * "soft-delete this record from its own drawer" entity (matches, opportunities,
 * …): DELETE /{resource}/{id} (reversible soft-delete) + POST
 * /{resource}/{id}/restore, each wrapped in its own loading flag, a confirm
 * dialog on archive, and a success/failure toast. Both routes are gated
 * server-side by their own permission — the caller only wires onArchive/
 * onRestore when the user actually has it (§3: no fake affordance). Enkelstuks:
 * the per-id route, never bulk-with-one-id (mirrors candidates BE 5970c03).
 * A per-entity error mapper (e.g. matches' 409 "active contract" message) is
 * passed in — the generic path just shows the plain failure toast.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notify } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import type { Id } from '@/types/common'

interface Args<Id_> {
  resource: string
  namespace: string
  onPatch: (id: Id_, patch: { archived: boolean; archivedAt: string | null }) => void
  onReload: () => void
  // Optional per-entity mapping of an archive failure to a specific message key.
  mapArchiveError?: (err: unknown) => string | null
}

export function useEntityArchive<Id_ extends Id | undefined = Id>({ resource, namespace, onPatch, onReload, mapArchiveError }: Args<Id_>) {
  const { t } = useTranslation(namespace)
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const { confirm, dialog } = useConfirm()

  const archive = (id: Id_) => {
    if (id == null || archiving) return
    confirm(t('drawer.archiveConfirm'), async () => {
      setArchiving(true)
      try {
        await api.delete(`/${resource}/${id}`)
        onPatch(id, { archived: true, archivedAt: new Date().toISOString() })
        onReload()
        notify('success', t('drawer.archived'))
      } catch (e) {
        const mapped = mapArchiveError?.(e)
        notify('error', mapped ?? t('drawer.archiveFailed'))
      } finally {
        setArchiving(false)
      }
    }, { danger: true })
  }

  const restore = async (id: Id_) => {
    if (id == null || restoring) return
    setRestoring(true)
    try {
      await api.post(`/${resource}/${id}/restore`)
      onPatch(id, { archived: false, archivedAt: null })
      onReload()
      notify('success', t('drawer.archivedBanner.restored'))
    } catch {
      notify('error', t('drawer.archivedBanner.restoreFailed'))
    } finally {
      setRestoring(false)
    }
  }

  return { archive, restore, archiving, restoring, dialog }
}
