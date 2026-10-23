import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
// The brand washes use the one §4 tint formula (identical color-mix output, no ad-hoc percentages in a raw string).
import { tint } from '@/lib/tint'

// Typographic wordmark — a crisp placeholder until the final logo asset is delivered
// (then swap <Wordmark/> for an <img>). Reads well on any background via tokens.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className} style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--color-primary-text)' }}>Koios</span>Match
    </span>
  )
}

// ── Shared layout wrapper — balanced brand hero left, login card right. ────────
export default function LoginShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth')
  // Copyright year is dynamic — never a stale hardcoded value.
  const year = new Date().getFullYear()
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Left — brand hero: a balanced Koios agent on a calm wash of the three brand colours. */}
      <div className="relative flex-col items-center hidden w-1/2 p-12 overflow-hidden text-center lg:flex xl:w-[55%]"
        style={{ background: [
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tint() IS the canonical §4 tint helper; the primary token here is only its argument (a decorative brand-hero wash, not an accent fill)
          `radial-gradient(90% 70% at 14% 6%, ${tint('var(--color-primary)', 20)}, transparent 56%)`,
          `radial-gradient(85% 75% at 92% 26%, ${tint('var(--color-secondary)', 17)}, transparent 56%)`,
          `radial-gradient(72% 62% at 82% 100%, ${tint('var(--color-accent)', 9)}, transparent 55%)`,
          'var(--sidebar-bg)',
        ].join(', ') }}>
        <Wordmark className="relative" />

        {/* Brand statement — the single headline, centred above the illustration. */}
        <p className="relative mt-10 font-semibold leading-snug" style={{ color: 'var(--sidebar-text)', fontSize: 27, maxWidth: 520 }}>
          {t('brand.sub')}
        </p>

        {/* Agent — balanced hero: centred with breathing room, capped so it never dominates or crops. */}
        <div className="relative flex items-center justify-center flex-1 min-h-0 py-6">
          <img src="/koios-agent.jpg" alt="Koios AI agent"
            className="object-contain rounded-3xl"
            style={{ maxHeight: '58%', maxWidth: '80%', filter: 'drop-shadow(0 12px 48px rgba(25,165,202,0.28))' }} />
        </div>

        <p className="relative text-xs" style={{ color: 'var(--sidebar-muted)' }}>© {year} KoiosMatch</p>
      </div>

      {/* Right — login card on a soft primary tint. */}
      <div className="relative flex items-center justify-center flex-1 p-6 sm:p-10"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 7%, var(--bg)) 0%, var(--bg) 55%)' }}>
        <div className="w-full" style={{ maxWidth: 400 }}>
          <div className="flex items-center justify-center gap-2 mb-6 lg:hidden">
            <Wordmark />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
            padding: '32px 30px 34px', boxShadow: 'var(--shadow-modal)' }}>
            {/* Landmark for the login card (WCAG 1.3.1) */}
            <main>{children}</main>
          </div>
          <p className="mt-6 text-xs text-center lg:hidden" style={{ color: 'var(--text-muted)' }}>© {year} KoiosMatch</p>
        </div>
      </div>
    </div>
  )
}
