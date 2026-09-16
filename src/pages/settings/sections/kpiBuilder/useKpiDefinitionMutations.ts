/**
 * useKpiDefinitionMutations — the KPI-builder's five writes for one entity tab:
 * create, patch (partial, absent field = unchanged), remove (soft, reversible),
 * restore (undo) and reorder (drag/keyboard). Every mutation invalidates the
 * `['kpi-definitions']` prefix (both the entity list and the tenant-wide total),
 * mirroring invalidateEntity's predicate style. `onError` surfaces the server's
 * own message (e.g. the cap 422) via extractApiError, never a generic toast only.
 *
 * `reorder` is optimistic against the entity's cached list, reverting to the
 * pre-drag snapshot on a rejected PUT — mirrors StatusListEditor.persistOrder's
 * revert-on-failure contract, expressed as a react-query optimistic mutation.
 */
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import {
  createKpiDefinition, patchKpiDefinition, deleteKpiDefinition, restoreKpiDefinition, putKpiDefinitionsOrder,
} from './kpiDefinitionsApi'
import type { KpiDefinition, KpiDefinitionCreate, KpiDefinitionPatch, KpiEntity } from './kpiDefinitionsApi'

export function useKpiDefinitionMutations(entity: KpiEntity, t: ReturnType<typeof useTranslation>['t']) {
  const queryClient = useQueryClient()

  // Every write invalidates both this entity's list and the tenant-wide total.
  const invalidateAll = () =>
    queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === 'kpi-definitions' })

  const onFailure = (key: string) => (err: unknown) =>
    notifyError(extractApiError(err, t(key)))

  const create = useMutation({
    mutationFn: (body: KpiDefinitionCreate) => createKpiDefinition(body),
    onSuccess: invalidateAll,
    onError: onFailure('kpiBuilder.saveFailed'),
  })

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: KpiDefinitionPatch }) => patchKpiDefinition(id, body),
    onSuccess: invalidateAll,
    onError: onFailure('kpiBuilder.saveFailed'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteKpiDefinition(id),
    onSuccess: invalidateAll,
    onError: onFailure('kpiBuilder.deleteFailed'),
  })

  const restore = useMutation({
    mutationFn: (id: string) => restoreKpiDefinition(id),
    onSuccess: invalidateAll,
    onError: onFailure('kpiBuilder.restoreFailed'),
  })

  // Optimistic reorder: write the new order into the entity's cache immediately,
  // revert to the snapshot taken in onMutate if the PUT is rejected.
  const reorder = useMutation({
    mutationFn: (ids: string[]) => putKpiDefinitionsOrder(ids),
    onMutate: async (ids: string[]) => {
      const key = ['kpi-definitions', entity]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<KpiDefinition[]>(key)
      if (previous) {
        const byId = new Map(previous.map(row => [row.id, row]))
        const next = ids.map(id => byId.get(id)).filter((row): row is KpiDefinition => row != null)
        queryClient.setQueryData(key, next)
      }
      return { previous }
    },
    onError: (err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(['kpi-definitions', entity], context.previous)
      onFailure('kpiBuilder.orderFailed')(err)
    },
    onSettled: invalidateAll,
  })

  return { create, patch, remove, restore, reorder }
}
