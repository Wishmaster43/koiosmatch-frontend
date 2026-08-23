/**
 * KoiosModelsCard — MODEL-KIEZER-1 (Danny 24-07 GO, supersedes MODEL-1's fixed
 * company model): the tenant PICKS their model as a package choice in customer
 * language — Snel (Haiku) / Slim (Sonnet) / Max (Opus) — within the platform
 * whitelist. The backend endpoint validates + audits; a model outside the
 * whitelist can never be set. Rates live in the pricing card below this one.
 *
 * KOIOS-MODEL-UI-1 (Danny 23-08, screenshot: "hoe kan ik nu zien welk model er
 * gekoppeld is? ... de klant kan alleen kiezen VAN het model"): two fixes.
 * (1) the active tier now also carries an explicit check mark — SegmentedControl's
 * showActiveCheck is on by DEFAULT since SEGMENTED-CHECK-SWEEP-1, so this card no
 * longer passes it explicitly. (2) the raw
 * vendor model id (claude-sonnet-5, ...) is a PLATFORM config detail, not a tenant
 * fact: it now shows only to a super admin (Danny's own "which model is this"
 * question), never to a normal tenant user.
 */
import { useState } from 'react'
import { Zap, Sparkles, Crown } from 'lucide-react'
import { updateKoiosModel } from './koiosApi'
import { tierKeyForModel } from '@/lib/koiosModelTiers'
import { useAuth } from '@/context/AuthContext'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { SectionTitle, Mono } from '@/components/ui/typography'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }

// Icon per tier — presentation only. The id→tier MATCH itself lives in the shared
// lib/koiosModelTiers (K-37) so this card and the floating Koios panel's model
// picker never drift into two hand-maintained id→tier maps (CLAUDE.md §11).
// HUISSTIJL-1: the per-tier accent colour (success/info/violet border+icon) is
// dropped in favour of the shared SegmentedControl's one look — the control takes
// a single group colour, not one per option, so tier identity now reads through
// the icon shape + label/description text instead of colour.
const TIER_ICON = { snel: Zap, slim: Sparkles, max: Crown }
const tierFor = (id) => {
  const key = tierKeyForModel(id)
  return { key, Icon: key ? TIER_ICON[key] : Sparkles }
}

export default function KoiosModelsCard({ models, t, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // MODEL-IDS PLATFORM-ONLY: only a super admin sees the raw vendor id — Danny's
  // own platform config, never a tenant fact (mirrors the SettingsPage/AppsSettings
  // isSuperAdmin() gate).
  const auth = useAuth()
  const isSuperAdmin = auth?.isSuperAdmin?.() ?? false
  const active = models?.active
  const selectable = models?.selectable ?? []
  // Honest state (§10 tolerant-by-contract, Opus F2): the backend's Policy keeps
  // `active` inside `selectable` today, but that is a config invariant, not a code
  // one — if it ever breaks, three unmarked radios would silently reproduce the
  // exact "which model is linked?" confusion this card exists to end.
  const activeUnknown = selectable.length > 0 && (active == null || !selectable.includes(active))

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

  // One radio option per selectable model — label is the tier name (a generic
  // fallback for a normal user when an id falls outside the known tiers; the raw
  // id itself never reaches the label for a non-super-admin). Description folds
  // in the tier blurb, and the raw model id in Mono style, ONLY for a super
  // admin — the id is platform config, never a tenant-visible fact.
  const modelOptions = selectable.map((m) => {
    const { key, Icon } = tierFor(m)
    const label = key ? t(`models.tier.${key}`) : (isSuperAdmin ? m : t('models.unknownTier'))
    const tierDesc = key ? t(`models.tierDesc.${key}`) : null
    const description = isSuperAdmin
      ? (tierDesc ? <>{tierDesc} · <Mono>{m}</Mono></> : <Mono>{m}</Mono>)
      : tierDesc
    return { value: m, label, description, icon: Icon }
  })

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('models.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('models.pickHint')}</div>

      {activeUnknown && (
        <div role="status" style={{ fontSize: 12, color: 'var(--color-warning-text)', marginBottom: 8 }}>{t('models.activeUnknown')}</div>
      )}
      <SegmentedControl commitOnFocus={false} options={modelOptions} value={active ?? ''} onChange={pick} ariaLabel={t('models.title')} />

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
