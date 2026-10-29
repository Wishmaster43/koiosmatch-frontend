// AddableSection — the icon-only edit/remove controls carry an accessible name and never submit a form.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddableSection from './AddableSection'

// Key-echo i18n stub: t(key) returns the key.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// The form is irrelevant here; a marker proves the edit click opened it.
vi.mock('./AddForm', () => ({ default: () => <div data-testid="add-form" /> }))

const setup = () => {
  const onEdit = vi.fn()
  const onRemove = vi.fn()
  render(
    <AddableSection title="T" items={[{ id: 1, name: 'A' }]} fields={[]} onAdd={vi.fn()} onEdit={onEdit} onRemove={onRemove}
      renderItem={item => <span>{String(item.name)}</span>} />,
  )
  return { onRemove }
}

describe('AddableSection controls', () => {
  it('names both icon-only buttons with aria-label and type=button', () => {
    setup()
    for (const name of ['edit', 'remove']) {
      const b = screen.getByRole('button', { name })
      expect(b).toHaveAttribute('aria-label', name)
      expect(b).toHaveAttribute('type', 'button')
    }
  })

  it('remove calls onRemove(0)', async () => {
    const { onRemove } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'remove' }))
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('edit opens the form', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'edit' }))
    expect(screen.getByTestId('add-form')).toBeInTheDocument()
  })
})
