/**
 * useApiKeys — loads the key list and exposes optimistic list mutations.
 *
 * Keeps the list state in one place so the container can switch between list and
 * detail without refetching, while create/update/delete keep the table in sync.
 */
import { useOptimisticList } from '@/hooks/useOptimisticList'
import { listApiKeys } from './apiKeysApi'

// Owns the key list state (see the module doc above) so the container can switch list/detail views without refetching, while mutations keep it in sync.
// K-282: add/patch also refetch the whole list — a type PATCH auto-demotes the
// previous primary key server-side, so a sibling row can change too; the
// optimistic update keeps the UI snappy while the reload corrects any drift.
export function useApiKeys() {
  const { items: keys, loading, error, reload, add, patch, drop } = useOptimisticList(listApiKeys, { refetchOnAdd: true, refetchOnPatch: true })
  return { keys, loading, error, reload, add, patch, drop }
}
