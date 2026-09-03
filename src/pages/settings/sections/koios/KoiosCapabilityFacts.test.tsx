/**
 * KoiosCapabilityFacts.test.tsx — unit tests for the capability facts component.
 * Asserts: (1) surfaces render as soft chips with i18n labels;
 * (2) limits rows render formatted values, including real zeros (never hidden by
 * a falsy check); (3) absent data renders nothing; (4) rate-limit strings render
 * as a localised phrase (nl included), falling back verbatim when unparseable.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import KoiosCapabilityFacts from './KoiosCapabilityFacts'
import type { KoiosSurface, KoiosLimits } from '@/components/layout/koios/useKoiosToolCapabilities'

// Mock i18n instance for testing — mirrors the real koios.json facts keys for
// both 'en' (default) and 'nl' (so rate-limit and percent locale formatting can
// be asserted against the actual house behaviour).
const createI18nInstance = (lng: 'en' | 'nl' = 'en') => {
  const instance = i18next.createInstance()
  instance.init({
    lng,
    ns: ['koios'],
    defaultNS: 'koios',
    resources: {
      en: {
        koios: {
          'capabilities.facts.surfaces': 'Surfaces',
          'capabilities.facts.limits': 'Limits',
          'capabilities.facts.maxTokens': 'Max. tokens per request',
          'capabilities.facts.monthlyBudget': 'Monthly budget',
          'capabilities.facts.warnAt': 'Warning at',
          'capabilities.facts.rateChat': 'Chat limit',
          'capabilities.facts.rateOther': 'Limit other actions',
          'capabilities.facts.perMinute': '{{count}} per minute',
          'capabilities.facts.perHour': '{{count}} per hour',
          'capabilities.facts.perSecond': '{{count}} per second',
          'capabilities.surfaces.chat': 'Chat',
          'capabilities.surfaces.note_assist': 'Note assist',
          'capabilities.surfaces.generate': 'Generate text',
          'capabilities.surfaces.conversation_assist': 'Conversation assist',
          'capabilities.surfaces.report_advice': 'Report advice',
          'capabilities.surfaces.interview_flows': 'Interview flows',
        },
      },
      nl: {
        koios: {
          'capabilities.facts.surfaces': 'Oppervlakken',
          'capabilities.facts.limits': 'Limieten',
          'capabilities.facts.maxTokens': 'Max. tokens per verzoek',
          'capabilities.facts.monthlyBudget': 'Maandbudget',
          'capabilities.facts.warnAt': 'Waarschuwing bij',
          'capabilities.facts.rateChat': 'Limiet chat',
          'capabilities.facts.rateOther': 'Limiet overige acties',
          'capabilities.facts.perMinute': '{{count}} per minuut',
          'capabilities.facts.perHour': '{{count}} per uur',
          'capabilities.facts.perSecond': '{{count}} per seconde',
          'capabilities.surfaces.chat': 'Chat',
        },
      },
    },
  })
  return instance
}

describe('KoiosCapabilityFacts', () => {
  it('renders nothing when surfaces and limits are both absent', () => {
    const i18n = createI18nInstance()
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts />
      </I18nextProvider>,
    )
    // When nothing renders, container has no children.
    expect(container.childElementCount).toBe(0)
  })

  it('renders the surfaces block with six chips', () => {
    const i18n = createI18nInstance()
    const surfaces: KoiosSurface[] = [
      { key: 'chat', label_nl: 'Chat', endpoint: 'https://example.com' },
      { key: 'note_assist', label_nl: 'Notitie-assistent', endpoint: 'https://example.com' },
      { key: 'generate', label_nl: 'Teksten genereren', endpoint: 'https://example.com' },
      { key: 'conversation_assist', label_nl: 'Gesprek-assistent', endpoint: 'https://example.com' },
      { key: 'report_advice', label_nl: 'Rapportage-advies', endpoint: 'https://example.com' },
      { key: 'interview_flows', label_nl: 'Interviewflows', endpoint: 'https://example.com' },
    ]
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts surfaces={surfaces} />
      </I18nextProvider>,
    )
    // Check all six surfaces are rendered with i18n labels.
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Note assist')).toBeInTheDocument()
    expect(screen.getByText('Generate text')).toBeInTheDocument()
    expect(screen.getByText('Conversation assist')).toBeInTheDocument()
    expect(screen.getByText('Report advice')).toBeInTheDocument()
    expect(screen.getByText('Interview flows')).toBeInTheDocument()
  })

  it('falls back to label_nl when i18n key is missing', () => {
    const i18n = createI18nInstance()
    // Add a surface with an unknown key so the fallback is used.
    const surfaces: KoiosSurface[] = [
      { key: 'unknown_surface', label_nl: 'My Custom Surface', endpoint: 'https://example.com' },
    ]
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts surfaces={surfaces} />
      </I18nextProvider>,
    )
    // Should render the API label_nl when i18n key is unknown.
    expect(screen.getByText('My Custom Surface')).toBeInTheDocument()
  })

  it('renders limits with formatted values', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 128000,
      monthly_budget_cents: 500000, // €5000
      warn_at_pct: 80,
      rate_limits: { chat: '20/min', other: '30/min' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // Check formatted max tokens (locale-aware grouping).
    expect(screen.getByText(/128.*000/)).toBeInTheDocument()
    // Check monthly budget (cents → euros via formatCurrency).
    expect(screen.getByText(/5.*000/)).toBeInTheDocument() // "€ 5,000" or "$5,000" depending on locale
    // Check warn_at percentage (locale-formatted, via the house formatPercent).
    expect(screen.getByText('80%')).toBeInTheDocument()
    // Rate limits render as a translated phrase, not the raw backend string.
    expect(screen.getByText('20 per minute')).toBeInTheDocument()
    expect(screen.getByText('30 per minute')).toBeInTheDocument()
    expect(screen.queryByText('20/min')).not.toBeInTheDocument()
  })

  it('renders limits when only some fields are present', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 50000,
      monthly_budget_cents: 0, // Zero budget renders as € 0,00
      warn_at_pct: 0, // Zero warn_at renders as 0%
      rate_limits: { chat: '10/min', other: '' }, // Empty other doesn't render
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // Check max tokens renders.
    expect(screen.getByText(/50.*000/)).toBeInTheDocument()
    // Budget (0 cents = € 0.00 in en-GB) should render, never hidden by a truthy check.
    expect(screen.getByText('€0.00')).toBeInTheDocument()
    // Warn_at (0%) should render.
    expect(screen.getByText('0%')).toBeInTheDocument()
    // Chat limit renders as a translated phrase.
    expect(screen.getByText('10 per minute')).toBeInTheDocument()
    // Empty other is "not configured" — its whole row is absent.
    expect(screen.queryByText('Limit other actions')).not.toBeInTheDocument()
  })

  it('renders both surfaces and limits together', () => {
    const i18n = createI18nInstance()
    const surfaces: KoiosSurface[] = [
      { key: 'chat', label_nl: 'Chat', endpoint: 'https://example.com' },
    ]
    const limits: KoiosLimits = {
      max_tokens_per_request: 100000,
      monthly_budget_cents: 1000000,
      warn_at_pct: 75,
      rate_limits: { chat: '20/min', other: '30/min' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts surfaces={surfaces} limits={limits} />
      </I18nextProvider>,
    )
    // Check both blocks are rendered.
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('20 per minute')).toBeInTheDocument()
  })

  it('does not render limits block when limits is undefined', () => {
    const i18n = createI18nInstance()
    const surfaces: KoiosSurface[] = [
      { key: 'chat', label_nl: 'Chat', endpoint: 'https://example.com' },
    ]
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts surfaces={surfaces} />
      </I18nextProvider>,
    )
    // Surfaces block should render, limits block should not.
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.queryByText('Max. tokens per request')).not.toBeInTheDocument()
  })

  it('renders the correct section labels', () => {
    const i18n = createI18nInstance()
    const surfaces: KoiosSurface[] = [
      { key: 'chat', label_nl: 'Chat', endpoint: 'https://example.com' },
    ]
    const limits: KoiosLimits = {
      max_tokens_per_request: 128000,
      monthly_budget_cents: 500000,
      warn_at_pct: 80,
      rate_limits: { chat: '20/min', other: '30/min' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts surfaces={surfaces} limits={limits} />
      </I18nextProvider>,
    )
    // Check section labels are rendered.
    expect(screen.getByText('Surfaces')).toBeInTheDocument()
    expect(screen.getByText('Limits')).toBeInTheDocument()
  })

  it('renders a zero monthly budget instead of hiding it', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 0,
      warn_at_pct: 50,
      rate_limits: { chat: '', other: '' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // The label and a real "0" value both render — a falsy check would hide the whole row.
    expect(screen.getByText('Monthly budget')).toBeInTheDocument()
    expect(screen.getByText('€0.00')).toBeInTheDocument()
  })

  it('renders a parsed rate limit as a localised phrase in nl', () => {
    const i18n = createI18nInstance('nl')
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 50,
      rate_limits: { chat: '20/min', other: '' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // '20/min' from the backend renders as the translated Dutch phrase, not the English fragment.
    expect(screen.getByText('20 per minuut')).toBeInTheDocument()
    expect(screen.queryByText('20/min')).not.toBeInTheDocument()
  })

  it('formats warn_at_pct with the locale decimal separator under nl', () => {
    const i18n = createI18nInstance('nl')
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 82.5,
      rate_limits: { chat: '', other: '' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // nl-NL uses a comma decimal separator, via the house formatPercent helper.
    expect(screen.getByText('82,5%')).toBeInTheDocument()
  })

  it('renders the current object rate-limit shape ({ count, per })', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 50,
      rate_limits: { chat: { count: 20, per: 'minute' }, other: { count: 30, per: 'minute' } },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // The BE's new object shape renders through the same translated phrase.
    expect(screen.getByText('20 per minute')).toBeInTheDocument()
    expect(screen.getByText('30 per minute')).toBeInTheDocument()
  })

  it('renders a zero-count object rate limit instead of hiding it', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 50,
      rate_limits: { chat: { count: 0, per: 'minute' }, other: '' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // A real 0 count still renders — the object shape is never truthy-hidden.
    expect(screen.getByText('0 per minute')).toBeInTheDocument()
  })

  it('renders object rate limits for hour and second units', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 50,
      rate_limits: { chat: { count: 5, per: 'hour' }, other: { count: 2, per: 'second' } },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    expect(screen.getByText('5 per hour')).toBeInTheDocument()
    expect(screen.getByText('2 per second')).toBeInTheDocument()
  })

  it('falls back to the raw string when a rate limit cannot be parsed', () => {
    const i18n = createI18nInstance()
    const limits: KoiosLimits = {
      max_tokens_per_request: 1000,
      monthly_budget_cents: 100,
      warn_at_pct: 50,
      rate_limits: { chat: 'unlimited', other: '' },
    }
    render(
      <I18nextProvider i18n={i18n}>
        <KoiosCapabilityFacts limits={limits} />
      </I18nextProvider>,
    )
    // An unparseable rate-limit string still renders — honest fallback, never hidden.
    expect(screen.getByText('unlimited')).toBeInTheDocument()
  })
})
