/**
 * BrandTheme — Koiosmatch huisstijl tokens.
 *
 * Gebruik:
 *   import { brand } from '../theme/BrandTheme'
 *   style={{ color: brand.primary, background: brand.primaryBg }}
 *
 * Of gebruik de CSS-variabelen direct:
 *   style={{ color: 'var(--color-primary)' }}
 *
 * De CSS-variabelen worden automatisch gezet via index.css.
 */

export const brand = {
  // ── Primaire kleur (blauw) ───────────────────────────────────────────────
  primary:       '#19A5CA',
  primaryLight:  '#4DBEDD',
  primaryBg:     '#E8F7FB',   // 10% tint van primary

  // ── Secundaire kleur (donkerblauw) ───────────────────────────────────────
  secondary:     '#1B60A9',
  secondaryLight:'#3A80CC',
  secondaryBg:   '#E8F0F9',

  // ── Accent (goud) ───────────────────────────────────────────────────────
  accent:        '#F0AB00',
  accentLight:   '#F5C840',
  accentBg:      '#FEF6E0',

  // ── Semantisch ──────────────────────────────────────────────────────────
  success:       'var(--color-success)',
  successBg:     'var(--color-success-bg)',
  warning:       'var(--color-warning)',
  warningBg:     'var(--color-warning-bg)',
  danger:        'var(--color-danger)',
  dangerBg:      'var(--color-danger-bg)',

  // ── Neutrale tints ──────────────────────────────────────────────────────
  text:          '#111827',
  textMuted:     '#6B7280',
  border:        '#E5E7EB',
  surface:       '#FFFFFF',
  bg:            '#F5F5F7',
}

/**
 * Veelgebruikte combinaties voor StatCard / KpiCard icoontjes.
 * Gebruik: <StatCard color={brandColors.primary.color} bg={brandColors.primary.bg} />
 */
export const brandColors = {
  primary:   { color: brand.primary,   bg: brand.primaryBg   },
  secondary: { color: brand.secondary, bg: brand.secondaryBg },
  accent:    { color: brand.accent,    bg: brand.accentBg    },
  success:   { color: brand.success,   bg: brand.successBg   },
  warning:   { color: brand.warning,   bg: brand.warningBg   },
  danger:    { color: brand.danger,    bg: brand.dangerBg    },
}
