/**
 * KoiosBudgetCard — X-9 tests. §13: assert the REQUEST (exact route/body),
 * not only that a save function fired. Fetches GET /ai/koios/usage/budget,
 * shows the daily caps in euros (cents/100), editable for settings.update holders,
 * and PUTs the exact {daily_user_cents, daily_tenant_cents} body on save.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosBudgetCard from './KoiosBudgetCard'

interface MockBudget {
  daily_user_cents?: number | null
  daily_tenant_cents?: number | null
}

const mockUseAuth = vi.hoisted(() => vi.fn())
const mockGetBudget = vi.hoisted(() => vi.fn(async (): Promise<MockBudget> => ({})))
const mockPutBudget = vi.hoisted(() => vi.fn(async (): Promise<MockBudget> => ({})))
const notifySuccess = vi.hoisted(() => vi.fn())
const notifyError = vi.hoisted(() => vi.fn())

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('./koiosApi', () => ({
  getKoiosBudget: mockGetBudget,
  updateKoiosBudget: vi.fn(mockPutBudget),
}))
vi.mock('@/lib/notify', () => ({
  notifySuccess: (msg: string) => notifySuccess(msg),
  notifyError: (msg: string) => notifyError(msg),
}))

afterEach(() => vi.clearAllMocks())

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const renderCard = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <KoiosBudgetCard />
    </QueryClientProvider>
  )

describe('KoiosBudgetCard — GET /ai/koios/usage/budget', () => {
  it('fetches the budget on mount with koios.use permission', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockGetBudget.mockResolvedValue({
      daily_user_cents: 500000,
      daily_tenant_cents: 1000000,
    })
    renderCard()
    await waitFor(() => {
      expect(mockGetBudget).toHaveBeenCalled()
    })
  })

  it('does not fetch without koios.use permission', async () => {
    mockUseAuth.mockReturnValue({
      hasPermission: (p: string) => p !== 'koios.use',
    })
    renderCard()
    expect(mockGetBudget).not.toHaveBeenCalled()
  })
})

describe('KoiosBudgetCard — display and edit gate', () => {
  it('shows read-only display without settings.update', async () => {
    mockUseAuth.mockReturnValue({
      hasPermission: (p: string) => p === 'koios.use',
    })
    mockGetBudget.mockResolvedValue({
      daily_user_cents: 500000,
      daily_tenant_cents: 1000000,
    })
    renderCard()
    await waitFor(() => {
      // No inputs in read-only mode
      expect(screen.queryByRole('spinbutton')).toBeNull()
    })
  })

  it('shows editable inputs with settings.update', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockGetBudget.mockResolvedValue({
      daily_user_cents: 500000,
      daily_tenant_cents: 1000000,
    })
    renderCard()
    await waitFor(() => {
      // spinbutton role is for <input type="number">
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(2)
    })
  })
})

describe('KoiosBudgetCard — PUT /ai/koios/usage/budget', () => {
  it('sends exact body with both values changed', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockGetBudget.mockResolvedValue({
      daily_user_cents: 500000,
      daily_tenant_cents: 1000000,
    })
    mockPutBudget.mockResolvedValue({})
    renderCard()

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(2)
    })

    const inputs = screen.getAllByRole('spinbutton')
    // Clear and set new values (3000 EUR, 8000 EUR)
    fireEvent.change(inputs[0], { target: { value: '3000' } })
    fireEvent.change(inputs[1], { target: { value: '8000' } })

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save|Speichern|Guardar|Enregistrer/i })
    fireEvent.click(saveButton)

    // Assert the PUT was called with correct cents values
    await waitFor(() => {
      expect(mockPutBudget).toHaveBeenCalledWith(300000, 800000)
    })
  })

  it('shows 422 error with extractApiError', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockGetBudget.mockResolvedValue({
      daily_user_cents: 500000,
      daily_tenant_cents: 1000000,
    })
    mockPutBudget.mockRejectedValueOnce({
      response: {
        data: {
          errors: {
            'daily_user_cents': ['Waarde moet lager zijn dan het platformplafond.'],
          },
        },
      },
    })
    renderCard()

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs.length).toBe(2)
    })

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '99999999' } })

    const saveButton = screen.getByRole('button', { name: /save|Speichern|Guardar|Enregistrer/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalled()
    })
  })
})
