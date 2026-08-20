/**
 * WorkflowTemplateLibrary — asserts the REAL filtered GET (route + params), per
 * §13: picking the "Koios AI" folder must round-trip a real ?category= request,
 * never just filter the already-loaded list client-side. Also covers the
 * unfiltered initial load and the "Use template" callback (no fake affordance —
 * the button must actually hand the picked template to the caller).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import WorkflowTemplateLibrary from './WorkflowTemplateLibrary'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'workflows', ...opts })

const allTemplates = [
  { id: 1, name: 'Send WhatsApp', description: 'Sends a WhatsApp message', category: 'koios_ai' },
  { id: 2, name: 'Onboarding',    description: 'Custom onboarding flow',   category: 'custom' },
]
const koiosAiTemplates = allTemplates.filter((tpl) => tpl.category === 'koios_ai')

// Mirrors GebruikSettings.test.jsx's mockApi convention: read the caller's params
// off the call itself rather than assuming a single fixed response.
function mockApi() {
  vi.mocked(api.get).mockImplementation((url: string, config?: Parameters<typeof api.get>[1]) => {
    if (url === '/workflow-templates') {
      const category = (config?.params as { category?: string } | undefined)?.category
      return Promise.resolve({ data: category === 'koios_ai' ? koiosAiTemplates : allTemplates })
    }
    return Promise.resolve({ data: [] })
  })
}

afterEach(() => vi.clearAllMocks())

describe('WorkflowTemplateLibrary', () => {
  it('GETs /workflow-templates with no category filter on open and lists every template', async () => {
    mockApi()
    render(<WorkflowTemplateLibrary open onClose={vi.fn()} onUseTemplate={vi.fn()} />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflow-templates', { params: {} }))
    expect(await screen.findByText('Send WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
  })

  it('re-fetches with ?category=koios_ai when the Koios AI folder is picked, showing only that category', async () => {
    mockApi()
    render(<WorkflowTemplateLibrary open onClose={vi.fn()} onUseTemplate={vi.fn()} />)
    await screen.findByText('Onboarding')

    // HUISSTIJL-1: the category picker is now the shared SegmentedControl radiogroup —
    // its options carry role="radio" (real keyboard semantics), not role="button".
    await userEvent.click(screen.getByRole('radio', { name: t('templateLibrary.koiosAiFolder') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflow-templates', { params: { category: 'koios_ai' } }))
    expect(await screen.findByText('Send WhatsApp')).toBeInTheDocument()
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument()
  })

  it('calls onUseTemplate with the picked template — the button is a real affordance, not a no-op', async () => {
    mockApi()
    const onUseTemplate = vi.fn()
    render(<WorkflowTemplateLibrary open onClose={vi.fn()} onUseTemplate={onUseTemplate} />)
    await screen.findByText('Send WhatsApp')

    // Each card's button names its own template, so it stays findable amongst others.
    await userEvent.click(screen.getByRole('button', { name: `${t('templateLibrary.useTemplate')} — Send WhatsApp` }))

    expect(onUseTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Send WhatsApp' }))
  })

  it('fetches nothing while closed', () => {
    mockApi()
    render(<WorkflowTemplateLibrary open={false} onClose={vi.fn()} onUseTemplate={vi.fn()} />)
    expect(api.get).not.toHaveBeenCalled()
  })
})
