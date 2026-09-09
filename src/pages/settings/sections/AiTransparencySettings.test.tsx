/**
 * AiTransparencySettings tests — renders from mocked /ai/transparency-info endpoint,
 * displays five principles, human oversight, tenant posture (read-only), and active features.
 * The link in KoiosPanel footer navigates to this page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import AiTransparencySettings from './AiTransparencySettings'

// Mock the axios client and react-query.
vi.mock('@/lib/api', async () => {
  return { default: { get: vi.fn() } }
})

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await (importOriginal as () => Promise<Record<string, unknown>>)()
  return {
    ...actual,
    useQuery: vi.fn((config: Record<string, unknown>) => {
      // Mock the transparency endpoint.
      const queryKey = Array.isArray(config.queryKey) ? config.queryKey : []
      if (queryKey[0] === 'ai' && queryKey[1] === 'transparency-info') {
        return {
          data: {
            principles: [
              'wizard_is_default',
              'no_automatic_selection_decisions',
              'every_action_is_a_logged_workflow',
              'ai_output_is_labeled',
              'toggles_never_disable_obligations',
            ],
            human_oversight_selection_decisions: true,
            tenant_posture: {
              mode_default: 'wizard',
              auto_messages: false,
            },
            features: [
              { key: 'koios_chat', active: true },
              { key: 'ai_agent_interviews', active: false },
              { key: 'ai_workflow_steps', active: true },
            ],
          },
          isLoading: false,
          isError: false,
        }
      }
      return { data: undefined, isLoading: false, isError: false }
    }),
  }
})

// Row 21: the two AI retention windows ride the shared settings form — mocked flat so
// the read-only rows keep rendering without a /settings round-trip.
const formSet = vi.fn()
vi.mock('../lib/useSettingsForm', () => ({
  useSettingsForm: () => ({
    values: { ai_prompt_log_retention_days: 90, koios_conversation_memory_days: 0 },
    set: formSet, dirty: false, loading: false, saving: false, saved: false, loadError: false, save: vi.fn(),
  }),
}))

describe('AiTransparencySettings', () => {
  beforeEach(() => {
    i18n.init()
  })

  it('renders the title and subtitle', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.subtitle', { ns: 'settings' }))).toBeInTheDocument()
    })
  })

  it('displays all five principles with title and body', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.principles.wizard_is_default.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.principles.no_automatic_selection_decisions.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.principles.every_action_is_a_logged_workflow.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.principles.ai_output_is_labeled.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.principles.toggles_never_disable_obligations.title', { ns: 'settings' }))).toBeInTheDocument()
    })
  })

  it('displays human oversight as always', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.humanOversight', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.humanOversightValue', { ns: 'settings' }))).toBeInTheDocument()
    })
  })

  it('displays tenant posture (default mode and auto messages)', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.tenantPosture.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.tenantPosture.defaultMode.label', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.tenantPosture.defaultMode.wizard', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.tenantPosture.autoMessages.label', { ns: 'settings' }))).toBeInTheDocument()
    })
  })

  it('displays features with active/inactive status via SoftChip', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.features.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.features.koios_chat', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.features.ai_agent_interviews', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('aiAct.features.ai_workflow_steps', { ns: 'settings' }))).toBeInTheDocument()
      // Two features are active, one is inactive.
      const activeChips = screen.getAllByText(i18n.t('aiAct.features.active', { ns: 'settings' }))
      expect(activeChips.length).toBe(2)
      expect(screen.getByText(i18n.t('aiAct.features.inactive', { ns: 'settings' }))).toBeInTheDocument()
    })
  })
})

// Row 21 (Danny 09-09, "Ik kan niets instellen??????"): the AI retention windows are
// editable here — prompt log (1..3650 days) and chat conversation memory (0..365, 0 = off).
describe('AiTransparencySettings · AI retention windows (row 21)', () => {
  it('renders both retention rows with the stored values', async () => {
    render(<AiTransparencySettings />)
    await waitFor(() => {
      expect(screen.getByText(i18n.t('aiAct.retention.title', { ns: 'settings' }))).toBeInTheDocument()
    })
    const promptLog = screen.getByRole('textbox', { name: i18n.t('aiAct.retention.promptLog.label', { ns: 'settings' }) })
    const memory = screen.getByRole('textbox', { name: i18n.t('aiAct.retention.conversationMemory.label', { ns: 'settings' }) })
    expect(promptLog).toHaveValue('90')
    expect(memory).toHaveValue('0')
  })

  it('writes an edited prompt-log window onto the settings form key', async () => {
    render(<AiTransparencySettings />)
    const promptLog = await screen.findByRole('textbox', { name: i18n.t('aiAct.retention.promptLog.label', { ns: 'settings' }) })
    fireEvent.change(promptLog, { target: { value: '120' } })
    fireEvent.blur(promptLog)
    expect(formSet).toHaveBeenCalledWith('ai_prompt_log_retention_days', 120)
  })
})
