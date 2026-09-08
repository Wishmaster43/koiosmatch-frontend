/**
 * useScopeEntityLevels — the permission levels the backend offers per scope entity
 * (SCOPE-LEVEL-READONLY-1, Danny default A: an entity the partner API serves read-only
 * offers only 'read', so the access grid never shows a write level that would be refused).
 * Until the route lands (or on any failure) the map stays EMPTY, which keeps today's
 * behaviour: every row offers every level (no face change without the hint).
 */
import { useEffect, useState } from 'react'
import { listScopeEntities } from './apiKeysApi'

// Load the per-entity level hint once; an alive guard drops a late response after unmount.
export function useScopeEntityLevels() {
  const [levelsByEntity, setLevelsByEntity] = useState({})
  useEffect(() => {
    let alive = true
    listScopeEntities()
      .then((rows) => {
        if (!alive) return
        const map = {}
        for (const row of rows ?? []) {
          if (row?.entity && Array.isArray(row.levels)) map[row.entity] = row.levels
        }
        setLevelsByEntity(map)
      })
      .catch(() => { /* no hint: every level stays offered (today's behaviour) */ })
    return () => { alive = false }
  }, [])
  return levelsByEntity
}
