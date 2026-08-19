/**
 * KoiosModelsCard — MODEL-KIEZER-1 (Danny 24-07 GO, supersedes MODEL-1's fixed
 * company model): the tenant PICKS their model as a package choice in customer
 * language — Snel (Haiku) / Slim (Sonnet) / Max (Opus) — within the platform
 * whitelist. The backend endpoint validates + audits; a model outside the
 * whitelist can never be set. Rates live in the pricing card below this one.
 */
import { useState } from 'react'
import { Zap, Sparkles, Crown } from 'lucide-react'
import { updateKoiosModel } from './koiosApi'
import { tierKeyForModel } from '@/lib/koiosModelTiers'
import SegmentedControl from '@/components/ui/SegmentedControl'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }

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
  const active = models?.active
  const selectable = models?.selectable ?? []

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

  // One radio option per selectable model — label is the tier name (raw model id
  // when it falls outside the known tiers), description folds in the tier blurb
  // AND the raw model id (monospace styling isn't part of the shared description
  // slot, so it rides along in the same line instead of silently disappearing).
  const modelOptions = selectable.map((m) => {
    const { key, Icon } = tierFor(m)
    return {
      value: m,
      label: key ? t(`models.tier.${key}`) : m,
      description: key ? `${t(`models.tierDesc.${key}`)} · ${m}` : undefined,
      icon: Icon,
    }
  })

  return (
    <div style={card}>
      <div style={cardTitle}>{t('models.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('models.pickHint')}</div>

      <SegmentedControl commitOnFocus={false} options={modelOptions} value={active ?? ''} onChange={pick} ariaLabel={t('models.title')} />

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
