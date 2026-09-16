/**
 * CustomerLocationTextPopout — audit fe-be-route-map-1: the pop-out travels under the
 * composite `<customerId>:<locationId>` id and reads/writes the NESTED customer-location
 * route (the bare /locations/{id} route is the bureau branch and always answered 'load
 * error'). Mirrors CustomerDepartmentTextPopout.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerLocationTextPopout from './CustomerLocationTextPopout'
import api from '@/lib/api'

// Captures `assistGenerate` (TextPopoutEditor's `generate` passed straight
// through) — the regression under test is which id (composite vs the
// location's own) reaches this prop.
const { generateArgs } = vi.hoisted(() => ({ generateArgs: { last: undefined as unknown } }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistGenerate }: { value: string; onChange: (html: string) => void; assistGenerate?: unknown }) => {
    generateArgs.last = assistGenerate
    return <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  },
}))
vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn(() => Promise.resolve({ data: {} })), get: vi.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  unwrapList: (r: { data: unknown }) => ({ rows: r.data }),
  getActiveTenantId: () => 'demo',
}))

const { liteState, liteArgs } = vi.hoisted(() => ({
  liteState: {
    location: null as { id: string; name: string; description: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
  liteArgs: { last: [] as unknown[] },
}))
vi.mock('../hooks/useCustomerTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useCustomerTextPopout')>()
  return { ...actual, useLocationTextLite: (...args: unknown[]) => { liteArgs.last = args; return liteState } }
})

describe('CustomerLocationTextPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.location = null; liteState.loading = false; liteState.error = false; liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('hands the parsed customer AND location id to the lite hook (nested route inputs)', () => {
    render(<CustomerLocationTextPopout id="cust-1:loc-1" />)
    expect(liteArgs.last).toEqual(['cust-1', 'loc-1'])
  })

  it('shows an error for a malformed (bare) id instead of fetching the wrong record', () => {
    render(<CustomerLocationTextPopout id="not-composite" />)
    expect(liteArgs.last).toEqual([undefined, undefined])
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('hands the Koios generate call the LOCATION\'s own id, never the composite pop-out id', () => {
    liteState.location = { id: 'loc-1', name: 'Vestiging Noord', description: 'a' }
    render(<CustomerLocationTextPopout id="cust-1:loc-1" />)
    expect(generateArgs.last).toEqual({ entity: 'location', id: 'loc-1' })
  })

  it('PATCHes /customers/{cid}/locations/{id} with the edited description and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.location = { id: 'loc-1', name: 'Vestiging Noord', description: 'a' }
    render(<CustomerLocationTextPopout id="cust-1:loc-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })
})
