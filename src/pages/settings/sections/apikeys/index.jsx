/**
 * ApiKeysSettings — container for the API-keys section. Owns the list state and
 * switches between the list and a single key's detail (same list↔detail pattern
 * as RolesSettings; no drawer). All data flows through the useApiKeys hook so the
 * table stays in sync after create / edit / delete.
 */
import { useState } from 'react'
import { useApiKeys } from './useApiKeys'
import ApiKeyList from './ApiKeyList'
import ApiKeyDetail from './ApiKeyDetail'
import ApiKeyCreate from './ApiKeyCreate'

export default function ApiKeysSettings() {
  const { keys, loading, error, reload, add, patch, drop } = useApiKeys()
  const [selectedId, setSelectedId] = useState(null)
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
        listRow={keys.find((k) => k.id === selectedId)}
        onBack={() => setSelectedId(null)}
        onPatch={patch}
        onDelete={(id) => { drop(id); setSelectedId(null) }}
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
