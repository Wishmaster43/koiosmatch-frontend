/**
 * useMyKoiosMode — the logged-in user's Koios AI mode: Wizard (confirm every
 * action) vs Auto (act immediately), plus the auto_messages sub-flag that only
 * applies in Auto mode. Own per-user resource (K0 contract, koiosmatch-api
 * COORDINATION-LOG 2026-08-06):
 *   GET/PUT /settings/my-koios-mode { mode: 'wizard'|'auto', auto_messages: bool }
 * Unknown keys 422 server-side, so the PUT body only ever carries these two
 * fields. Wizard is the safe default (O-17, AI-Act — selection decisions never
 * run unattended) until the real value resolves. Both fields save optimistically
 * with rollback + toast on failure, mirroring useWorkflowsData's handleToggleStatus.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'

export type KoiosMode = 'wizard' | 'auto'
export interface MyKoiosModeData { mode: KoiosMode; auto_messages: boolean }

// Wizard-only, messages off — the safe starting point before the GET resolves.
const DEFAULT_MODE: MyKoiosModeData = { mode: 'wizard', auto_messages: false }

// Narrow an arbitrary API payload down to exactly the two known fields — never
// forward extra keys the backend might add later into a PUT body (422 risk).
function normalize(raw: unknown): MyKoiosModeData {
  const r = (raw ?? {}) as Partial<MyKoiosModeData>
  return { mode: r.mode === 'auto' ? 'auto' : 'wizard', auto_messages: Boolean(r.auto_messages) }
}

// Loads and updates the signed-in user's own Koios mode (wizard/auto) + auto-messages flag, starting from the safe DEFAULT_MODE above.
export function useMyKoiosMode() {
  const { t } = useTranslation('auth')
  const [data, setData] = useState<MyKoiosModeData>(DEFAULT_MODE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load once on mount.
  useEffect(() => {
    let alive = true
    api.get('/settings/my-koios-mode')
      .then((res) => { if (alive) setData(normalize(unwrap(res))) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Persist a full { mode, auto_messages } snapshot optimistically; roll back
  // and toast on failure so a dropped PUT never leaves a silently wrong UI state.
  const save = (next: MyKoiosModeData) => {
    const prev = data
    setData(next)
    api.put('/settings/my-koios-mode', next).catch(() => {
      setData(prev)
      notifyError(t('profile.saveFailed'))
    })
  }

  const setMode = (mode: KoiosMode) => save({ ...data, mode })
  const setAutoMessages = (auto_messages: boolean) => save({ ...data, auto_messages })

  return { mode: data.mode, autoMessages: data.auto_messages, loading, error, setMode, setAutoMessages }
}
