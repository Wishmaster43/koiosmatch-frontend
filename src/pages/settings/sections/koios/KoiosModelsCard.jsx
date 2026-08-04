/**
 * KoiosModelsCard — MODEL-KIEZER-1 (Danny 24-07 GO, supersedes MODEL-1's fixed
 * company model): the tenant PICKS their model as a package choice in customer
 * language — Snel (Haiku) / Slim (Sonnet) / Max (Opus) — within the platform
 * whitelist. The backend endpoint validates + audits; a model outside the
 * whitelist can never be set. Rates live in the pricing card below this one.
 */
import { useState } from 'react'
import { Zap, Sparkles, Crown, Check } from 'lucide-react'
import { updateKoiosModel } from './koiosApi'
import { tierKeyForModel } from '@/lib/koiosModelTiers'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }

// Icon/colour per tier — presentation only. The id→tier MATCH itself lives in the
// shared lib/koiosModelTiers (K-37) so this card and the floating Koios panel's
// model picker never drift into two hand-maintained id→tier maps (CLAUDE.md §11).
const TIER_STYLE = {
  snel: { Icon: Zap, color: '#059669' },
  slim: { Icon: Sparkles, color: '#2563EB' },
  max:  { Icon: Crown, color: '#7C3AED' },
}
const tierFor = (id) => {
  const key = tierKeyForModel(id)
  return key ? { key, ...TIER_STYLE[key] } : { key: null, Icon: Sparkles, color: 'var(--text-muted)' }
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

  return (
    <div style={card}>
      <div style={cardTitle}>{t('models.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('models.pickHint')}</div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selectable.length || 1, 3)}, 1fr)`, gap: 10 }}>
        {selectable.map((m) => {
          const { key, Icon, color } = tierFor(m)
          const on = m === active
          return (
            <button key={m} type="button" onClick={() => pick(m)} disabled={saving} aria-pressed={on}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '12px 14px', borderRadius: 10, cursor: on ? 'default' : 'pointer', textAlign: 'left',
                border: `2px solid ${on ? color : 'var(--border)'}`,
                background: on ? `color-mix(in srgb, ${color} 8%, transparent)` : 'var(--surface)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <Icon size={15} color={color} />
                <span style={{ fontSize: 13, fontWeight: 600, color: on ? color : 'var(--text)' }}>
                  {key ? t(`models.tier.${key}`) : m}
                </span>
                {on && <Check size={14} color={color} style={{ marginLeft: 'auto' }} />}
              </span>
              {key && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t(`models.tierDesc.${key}`)}</span>}
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m}</span>
            </button>
          )
        })}
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
