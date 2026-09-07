/**
 * KoiosModelsCard — MODEL-KIEZER-1 (Danny 24-07 GO, supersedes MODEL-1's fixed
 * company model): the tenant PICKS their model as a package choice in customer
 * language — Snel (Haiku) / Slim (Sonnet) / Max (Opus) — within the platform
 * whitelist. The backend endpoint validates + audits.
 *
 * KOIOS-MODEL-UI-1 (Danny 23-08, screenshot: "hoe kan ik nu zien welk model er
 * gekoppeld is? ... de klant kan alleen kiezen VAN het model"): two fixes.
 * (1) the active tier now also carries an explicit check mark — SegmentedControl's
 * showActiveCheck is on by DEFAULT since SEGMENTED-CHECK-SWEEP-1, so this card no
 * longer passes it explicitly. (2) the raw
 * vendor model id (claude-sonnet-5, ...) is a PLATFORM config detail, not a tenant
 * fact: it now shows only to a super admin (Danny's own "which model is this"
 * question), never to a normal tenant user.
 *
 * KOIOS-MODEL-VOCAB-1 (27-08): label/hint now read the server's own
 * `models.options[]` (AI-MODELS-1: friendly label + relative cost hint, never a
 * number) FIRST — the SAME vocabulary the floating Koios panel's model picker
 * reads (`lib/koiosModelTiers`) — falling back to the shared tier substring match
 * only for an id the server didn't list.
 */
import { useState, useMemo } from 'react'
import { Zap, Sparkles, Crown } from 'lucide-react'
import { updateKoiosModel } from './koiosApi'
import { tierKeyForModel, findModelOption, resolveModelLabel, resolveModelHint } from '@/lib/koiosModelTiers'
import { useAuth } from '@/context/AuthContext'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'

// Frozen empty lists so a missing payload keeps one stable identity (memo deps).
const EMPTY_SELECTABLE = []
const EMPTY_OPTIONS = []

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }

// Icon per option — presentation only, no vocabulary of its own. Picked by
// relative COST RANK (1 = cheapest → Zap, the highest listed rank → Crown,
// anything between → Sparkles) so it never depends on a specific flavour id/key.
const TIER_ICON = { fast: Zap, smart: Sparkles, max: Crown }
const iconForRank = (rank, maxRank) => (rank === 1 ? Zap : rank === maxRank ? Crown : Sparkles)

// The three known flavour keys the server now serves as `selectable[]`/`options[]`
// ids (KOIOS-MODEL-VOCAB-1) — mirrors lib/koiosModelTiers' FLAVOR_TIER_MAP.
const FLAVOR_TIER_KEYS = ['fast', 'smart', 'max']

// Tenant-facing model-tier picker (Snel/Slim/Max); the raw vendor id stays
// super-admin-only (see the module doc comment above).
export default function KoiosModelsCard({ models, t, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [pendingPick, setPendingPick] = useState(null)
  // MODEL-IDS PLATFORM-ONLY: only a super admin sees the raw vendor id — Danny's
  // own platform config, never a tenant fact (mirrors the SettingsPage/AppsSettings
  // isSuperAdmin() gate).
  const auth = useAuth()
  const isSuperAdmin = auth?.isSuperAdmin?.() ?? false
  const active = models?.active
  const selectable = models?.selectable ?? EMPTY_SELECTABLE
  const serverOptions = models?.options ?? EMPTY_OPTIONS
  const costNote = models?.cost_note
  // Honest state (§10 tolerant-by-contract, Opus F2): the backend's Policy keeps
  // `active` inside `selectable` today, but that is a config invariant, not a code
  // one — if it ever breaks, three unmarked radios would silently reproduce the
  // exact "which model is linked?" confusion this card exists to end.
  const activeUnknown = selectable.length > 0 && (active == null || !selectable.includes(active))

  // Find cost_rank for active and candidate models to compare.
  const getModelCostRank = (model) => findModelOption(model, serverOptions)?.cost_rank ?? 1
  const activeCostRank = getModelCostRank(active)

  // Handle model selection with costlier-model warning logic.
  const handleChange = (model) => {
    if (model === active || saving) return
    const candidateCostRank = getModelCostRank(model)
    // If the candidate model costs more, show a warning instead of picking immediately.
    if (candidateCostRank > activeCostRank) {
      setPendingPick(model)
      setError(null)
    } else {
      // Equal or cheaper cost goes through immediately.
      pick(model)
    }
  }

  // Confirm the pending costlier-model pick.
  const confirmPick = async () => {
    if (pendingPick != null) {
      await pick(pendingPick)
      setPendingPick(null)
    }
  }

  // Cancel the pending pick.
  const cancelPick = () => {
    setPendingPick(null)
  }

  // Pick a tier — no optimism: wait for the server (it validates the whitelist).
  const pick = async (model) => {
    if (model === active || saving) return
    setSaving(true); setError(null)
    try {
      await updateKoiosModel(model)
      onChanged?.(model)
    } catch {
      setError(t('models.saveError'))
    }
    setSaving(false)
  }

  // Highest cost_rank across the server options, for the icon's rank comparison.
  const maxRank = useMemo(
    () => serverOptions.reduce((max, o) => Math.max(max, o.cost_rank ?? 1), 1),
    [serverOptions],
  )

  // One radio option per selectable model — server label/hint FIRST (KOIOS-MODEL-
  // VOCAB-1), the shared tier substring match as fallback for an id the server
  // didn't list, and finally the raw id for a super admin / the generic unknown-
  // tier copy for anyone else. Description folds in the hint, and the raw model
  // id in Mono style, ONLY for a super admin — the id is platform config, never a
  // tenant-visible fact.
  const modelOptions = useMemo(() => selectable.map((m) => {
    const option = findModelOption(m, serverOptions)
    const key = tierKeyForModel(m)
    const flavorTier = FLAVOR_TIER_KEYS.includes(m)
    const Icon = option ? iconForRank(option.cost_rank, maxRank) : (key ? TIER_ICON[key] : Sparkles)
    // I18N FIX (27-08): translated label/hint for a known flavour win over the
    // server's Dutch-only platform copy — see koiosModelTiers.resolveModelLabel/Hint.
    // A truly unmapped id (no flavour, no option, no tier) keeps the honest
    // super-admin-only raw id / generic "unknown tier" copy for anyone else.
    const label = (flavorTier || option || key) ? resolveModelLabel(m, serverOptions, t) : (isSuperAdmin ? m : t('models.unknownTier'))
    const hint = resolveModelHint(m, serverOptions, t) ?? (key ? t(`models.tierDesc.${key}`) : null)
    const description = isSuperAdmin
      ? (hint ? <>{hint} · <Mono>{m}</Mono></> : <Mono>{m}</Mono>)
      : hint
    return { value: m, label, description, icon: Icon }
  }), [selectable, serverOptions, maxRank, t, isSuperAdmin])

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('models.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('models.pickHint')}</div>

      {activeUnknown && (
        <div role="status" style={{ fontSize: 12, color: 'var(--color-warning-text)', marginBottom: 8 }}>{t('models.activeUnknown')}</div>
      )}
      <SegmentedControl commitOnFocus={false} options={modelOptions} value={pendingPick ?? active ?? ''} onChange={handleChange} ariaLabel={t('models.title')} />

      {costNote && (
        <Caption style={{ marginTop: 8, display: 'block' }}>{costNote}</Caption>
      )}

      {pendingPick && (
        <div style={{ marginTop: 12 }}>
          <div role="status" style={{ fontSize: 12, color: 'var(--color-warning-text)', marginBottom: 8 }}>
            {t('models.costlierWarning', { model: resolveModelLabel(pendingPick, serverOptions, t) })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" onClick={confirmPick} disabled={saving}>{t('models.costlierConfirm')}</Button>
            <Button variant="ghost" size="sm" onClick={cancelPick} disabled={saving}>{t('common:cancel')}</Button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
