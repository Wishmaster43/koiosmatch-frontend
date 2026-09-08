/**
 * EntityHeader — regression test for the photo-upload blob: URL lifecycle. Picking a
 * file creates an object URL for the preview; a second pick (or unmount) must revoke
 * the previous one — otherwise every avatar upload leaks memory for the tab's lifetime.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import '@/i18n'
import EntityHeader from './EntityHeader'

// jsdom has no real blob: URL support — stub with predictable, distinguishable values.
let urlSeq = 0
const createObjectURL = vi.fn(() => `blob:mock-${++urlSeq}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
  urlSeq = 0
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
})
afterEach(() => {
  // Unmount WHILE the stub is still active — otherwise the unmount-time revoke effect
  // (RTL's own auto-cleanup) runs after globals are restored and throws on the real URL.
  cleanup()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.unstubAllGlobals()
})

function renderWithAvatar(onPhotoChange = vi.fn()) {
  return render(
    <EntityHeader label="Candidate" title="Jane Doe"
      avatar={{ initials: 'JD', photo: null }} onPhotoChange={onPhotoChange} />
  )
}

// Picks a file through the avatar's (always-mounted, visually hidden) file input.
function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('EntityHeader photo upload', () => {
  it('revokes the previous object URL when a new photo is picked', () => {
    const onPhotoChange = vi.fn()
    const { container } = renderWithAvatar(onPhotoChange)
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })

    pickFile(container, fileA)
    expect(onPhotoChange).toHaveBeenCalledWith('blob:mock-1')
    expect(revokeObjectURL).not.toHaveBeenCalled()

    pickFile(container, fileB)
    expect(onPhotoChange).toHaveBeenCalledWith('blob:mock-2')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('revokes the tracked object URL on unmount', () => {
    const { container, unmount } = renderWithAvatar()
    pickFile(container, new File(['a'], 'a.png', { type: 'image/png' }))
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
  })

  it('does not revoke anything on unmount when no photo was ever picked', () => {
    const { unmount } = renderWithAvatar()
    unmount()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})

// DROPDOWN-CLEAR-1 (B2): a meta picker declared `clearable` renders the shared clear X
// (accessible name "<label> wissen") and hands '' to onChange; without the flag no X.
describe('EntityHeader · meta picker clear (DROPDOWN-CLEAR-1)', () => {
  const pickers = (clearable: boolean, onChange = vi.fn()) => [{
    key: 'owner', label: 'Owner', value: 'u-1',
    options: [{ value: 'u-1', label: 'Jane Doe' }, { value: 'u-2', label: 'Piet de Vries' }],
    onChange, clearable, clearLabel: 'Owner',
  }]

  it('renders the clear X on a clearable picker with a value and hands "" to onChange', () => {
    const onChange = vi.fn()
    render(<EntityHeader label="Vacancy" title="Verpleegkundige" meta={pickers(true, onChange)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner wissen' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('renders no clear X when the picker opts out', () => {
    render(<EntityHeader label="Vacancy" title="Verpleegkundige" meta={pickers(false)} />)
    expect(screen.queryByRole('button', { name: /wissen$/ })).toBeNull()
  })
})
