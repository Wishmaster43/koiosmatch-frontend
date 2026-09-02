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
// KOIOS-MODE-DEFAULT: the bureau-wide tenant default and the user's OWN choice,
// carried alongside the effective values above — null on user_choice means the
// user never picked, so the effective value came from the tenant default.
export interface KoiosModeDefaults { mode: KoiosMode; autoMessages: boolean }
export interface KoiosModeUserChoice { mode: KoiosMode | null; autoMessages: boolean | null }

// Wizard-only, messages off — the safe starting point before the GET resolves.
const DEFAULT_MODE: MyKoiosModeData = { mode: 'wizard', auto_messages: false }
const DEFAULT_TENANT_DEFAULT: KoiosModeDefaults = { mode: 'wizard', autoMessages: false }
const DEFAULT_USER_CHOICE: KoiosModeUserChoice = { mode: null, autoMessages: null }

// Narrow an arbitrary API payload down to exactly the two known fields — never
// forward extra keys the backend might add later into a PUT body (422 risk).
function normalize(raw: unknown): MyKoiosModeData {
  const r = (raw ?? {}) as Partial<MyKoiosModeData>
  return { mode: r.mode === 'auto' ? 'auto' : 'wizard', auto_messages: Boolean(r.auto_messages) }
}

// Same shape-narrowing as normalize(), for the nested tenant_default object.
function normalizeTenantDefault(raw: unknown): KoiosModeDefaults {
  const r = (raw ?? {}) as { mode?: unknown; auto_messages?: unknown }
  return { mode: r.mode === 'auto' ? 'auto' : 'wizard', autoMessages: Boolean(r.auto_messages) }
}

// user_choice keeps null-as-"nothing chosen" distinct from a real wizard/auto pick.
function normalizeUserChoice(raw: unknown): KoiosModeUserChoice {
  const r = (raw ?? {}) as { mode?: unknown; auto_messages?: unknown }
  return {
    mode: r.mode === 'wizard' || r.mode === 'auto' ? r.mode : null,
    autoMessages: typeof r.auto_messages === 'boolean' ? r.auto_messages : null,
  }
}

// Loads and updates the signed-in user's own Koios mode (wizard/auto) + auto-messages flag, starting from the safe DEFAULT_MODE above.
export function useMyKoiosMode() {
  const { t } = useTranslation('auth')
  const [data, setData] = useState<MyKoiosModeData>(DEFAULT_MODE)
  const [tenantDefault, setTenantDefault] = useState<KoiosModeDefaults>(DEFAULT_TENANT_DEFAULT)
  const [userChoice, setUserChoice] = useState<KoiosModeUserChoice>(DEFAULT_USER_CHOICE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load once on mount.
  useEffect(() => {
    let alive = true
    api.get('/settings/my-koios-mode')
      .then((res) => {
        if (!alive) return
        const raw = unwrap(res) as { tenant_default?: unknown; user_choice?: unknown }
        setData(normalize(raw))
        setTenantDefault(normalizeTenantDefault(raw?.tenant_default))
        setUserChoice(normalizeUserChoice(raw?.user_choice))
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Persist a full { mode, auto_messages } snapshot optimistically; roll back
  // and toast on failure so a dropped PUT never leaves a silently wrong UI state.
  // A successful save is always an explicit user choice (the PUT body always
  // carries both fields), so it also clears the "bureau default" state.
  const save = (next: MyKoiosModeData) => {
    const prev = data
    const prevChoice = userChoice
    setData(next)
    setUserChoice({ mode: next.mode, autoMessages: next.auto_messages })
    api.put('/settings/my-koios-mode', next).catch(() => {
      setData(prev)
      setUserChoice(prevChoice)
      notifyError(t('profile.saveFailed'))
    })
  }

  const setMode = (mode: KoiosMode) => save({ ...data, mode })
  const setAutoMessages = (auto_messages: boolean) => save({ ...data, auto_messages })

  // isBureauDefault: the user never chose — the effective values above come
  // from the tenant-wide default, so surfaces show the "(bureaustandaard)" hint.
  const isBureauDefault = userChoice.mode === null

  return {
    mode: data.mode, autoMessages: data.auto_messages, loading, error, setMode, setAutoMessages,
    tenantDefault, userChoice, isBureauDefault,
  }
}
