/**
 * ApiKeysSettings — container for the API-keys section. Owns the list state and
 * switches between the list and a single key's detail (same list↔detail pattern
 * as RolesSettings; no drawer). All data flows through the useApiKeys hook so the
 * table stays in sync after create / edit / delete.
 */
import { useState } from 'react'
import { useApiKeys } from './useApiKeys'
import ApiKeyList from './ApiKeyList'
import type { ApiKeyRow } from './ApiKeyList'
import ApiKeyDetail from './ApiKeyDetail'
import ApiKeyCreate from './ApiKeyCreate'

// Container for the API-keys section: switches between the list, a create
// screen and a single key's detail, all backed by the one useApiKeys hook.
export default function ApiKeysSettings() {
  // useApiKeys() reads its row type from the still-untyped apiKeysApi.js —
  // cast at the one boundary where the real shape (ApiKeyList's own) is known.
  const { keys, loading, error, reload, add, patch, drop } = useApiKeys() as {
    keys: ApiKeyRow[]
    loading: boolean
    error: boolean
    reload: () => void
    add: (row: unknown) => void
    patch: (id: string, row: unknown) => void
    drop: (id: string) => void
  }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Create view replaces the list (inline, no modal) — same pattern as detail.
  if (creating) {
    return <ApiKeyCreate onBack={() => setCreating(false)} onCreated={add} />
  }

  // Detail replaces the list while a key is open.
  if (selectedId) {
    return (
      <ApiKeyDetail
        keyId={selectedId}
        listRow={keys.find((k: { id: unknown }) => k.id === selectedId)}
        onBack={() => setSelectedId(null)}
        onPatch={patch}
        onDelete={(id: string) => { drop(id); setSelectedId(null) }}
      />
    )
  }

  return (
    <ApiKeyList
      keys={keys}
      loading={loading}
      error={error}
      onReload={reload}
      onOpen={setSelectedId}
      onNew={() => setCreating(true)}
    />
  )
}
