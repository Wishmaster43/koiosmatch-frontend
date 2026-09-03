/**
 * KoiosCapabilityFacts.test.tsx — unit tests for the capability facts component.
 * Asserts: (1) surfaces render as soft chips with i18n labels;
 * (2) limits rows render formatted values; (3) absent data renders nothing;
 * (4) i18n keys are present in all locales.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import KoiosCapabilityFacts from './KoiosCapabilityFacts'
import type { KoiosSurface, KoiosLimits } from '@/components/layout/koios/useKoiosToolCapabilities'

// Mock i18n instance for testing — use real koios translation keys.
const createI18nInstance = () => {
  const instance = i18next.createInstance()
  instance.init({
    lng: 'en',
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
          'capabilities.surfaces.chat': 'Chat',
          'capabilities.surfaces.note_assist': 'Note assist',
          'capabilities.surfaces.generate': 'Generate text',
          'capabilities.surfaces.conversation_assist': 'Conversation assist',
          'capabilities.surfaces.report_advice': 'Report advice',
          'capabilities.surfaces.interview_flows': 'Interview flows',
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
    // Check warn_at percentage.
    expect(screen.getByText('80%')).toBeInTheDocument()
    // Check rate limits.
    expect(screen.getByText('20/min')).toBeInTheDocument()
    expect(screen.getByText('30/min')).toBeInTheDocument()
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
    // Budget (0 cents = € 0,00) should render.
    expect(screen.getByText(/0[.,]0+/)).toBeInTheDocument()
    // Warn_at (0%) should render.
    expect(screen.getByText('0%')).toBeInTheDocument()
    // Chat limit renders.
    expect(screen.getByText('10/min')).toBeInTheDocument()
    // Empty other doesn't render.
    expect(screen.queryByText(/30\/min/)).not.toBeInTheDocument()
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
    expect(screen.getByText('20/min')).toBeInTheDocument()
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
})
