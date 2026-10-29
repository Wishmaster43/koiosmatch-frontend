/**
 * BlurSaveField — own behaviour test. §13: assertions target the REQUEST
 * (POST /settings body), never only a callback.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlurSaveField from './BlurSaveField'

// Real saveSettingsKeys runs; only the api seam is mocked so the body is asserted.
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

afterEach(() => { vi.clearAllMocks() })

// Render the atom with plain-string props (it takes labels as props).
function setup(props: Partial<React.ComponentProps<typeof BlurSaveField>> = {}) {
  render(
    <BlurSaveField
      settingKey="k" stored="old" label="Field" description="Help" placeholder="ph"
      {...props}
    />,
  )
  return { user: userEvent.setup(), input: screen.getByLabelText('Field') as HTMLInputElement }
}

describe('BlurSaveField', () => {
  // A changed value is trimmed and POSTed under exactly its own key.
  it('POSTs { key: trimmed } to /settings on blur', async () => {
    const { user, input } = setup()
    await user.clear(input)
    await user.type(input, '  new  ')
    await user.tab()
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/settings', { k: 'new' })
  })

  // An unchanged value must not hit the server.
  it('sends no request when the value is unchanged', async () => {
    const { user, input } = setup()
    await user.click(input)
    await user.tab()
    expect(postMock).not.toHaveBeenCalled()
  })

  // Clearing is always allowed and persists the empty string.
  it('allows an empty value and POSTs { key: "" }', async () => {
    const { user, input } = setup({ isValid: () => false })
    await user.clear(input)
    await user.tab()
    expect(postMock).toHaveBeenCalledWith('/settings', { k: '' })
  })

  // A failing validator shows the alert and blocks the save.
  it('shows invalidMessage with role=alert and sends nothing when invalid', async () => {
    const { user, input } = setup({ isValid: () => false, invalidMessage: 'Not valid' })
    await user.clear(input)
    await user.type(input, 'bad')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent('Not valid')
    expect(postMock).not.toHaveBeenCalled()
  })

  // A refused save reverts the draft to the stored value.
  it('reverts the draft to stored when the save is refused', async () => {
    postMock.mockRejectedValueOnce(new Error('422'))
    const { user, input } = setup()
    await user.clear(input)
    await user.type(input, 'rejected')
    await user.tab()
    await vi.waitFor(() => expect(input.value).toBe('old'))
  })

  // The invalid state is exposed to assistive tech and linked to its message.
  it('marks the input aria-invalid and points aria-describedby at the alert', async () => {
    const { user, input } = setup({ isValid: () => false, invalidMessage: 'Not valid' })
    await user.clear(input)
    await user.type(input, 'x')
    await user.tab()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })
})
