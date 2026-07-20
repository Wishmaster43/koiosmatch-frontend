// facebook_send module (FB-LEADS-1) — reports a lead-quality event BACK to
// Meta's Conversions API so ad delivery optimises on real outcomes, not just
// the initial lead. Matched server-side on the stored facebook_leads_id — no
// candidate PII ever leaves the platform (koiosmatch-api FacebookSendModule).
// lucide-react ships no Facebook glyph — Megaphone mirrors the icon Settings →
// Integraties already uses for Facebook Leads (registry.jsx), so the two
// surfaces read as the same feature.
import { Megaphone } from 'lucide-react'

export default {
  type:  'facebook_send',
  category: 'Facebook',
  label: 'Facebook terugkoppeling',
  Icon:  Megaphone,
  // Token colours (§4): secondary blue keeps this visually distinct from the
  // generic webhook (info) and AI (violet) categories — no ad-hoc hex.
  color: 'var(--color-secondary)',
  bg:    'var(--color-secondary-bg)',
  schema: [
    {
      key: 'event_name', label: 'Terug te melden gebeurtenis', type: 'select', default: 'Lead',
      // Meta's own Conversions API event-name constants — DATA, not translated
      // (only the field LABEL above goes through i18n; see moduleI18n.optionLabel's
      // raw-value fallback, same treatment as e.g. intus_candidates' HTTP methods).
      options: ['Lead', 'CompleteRegistration', 'Schedule', 'SubmitApplication', 'Purchase'],
    },
  ],
}
