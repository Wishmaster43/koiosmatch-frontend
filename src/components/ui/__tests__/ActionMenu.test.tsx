/**
 * ActionMenu — regression test (HUISSTIJL slotaudit finding 16, BTN-4): the
 * free-text input's submit button and the multi-select confirm bar both render
 * through the shared Button component now, instead of a hand-painted primary
 * fill duplicated twice in the same file. Pins Button's sm identity (borderRadius
 * 6/height 28px) on both submit buttons so a repainted inline style turns red.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionMenu from '../ActionMenu'
import type { MenuNode } from '../ActionMenu'

describe('ActionMenu — submit buttons share the Button sm identity', () => {
  it('the free-text input node submit button renders as a Button (sm radius/height)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const items: MenuNode[] = [{ key: 'note', label: 'Notitie toevoegen', input: true, onSubmit, submitLabel: 'Opslaan' }]
    render(<ActionMenu label="Acties" items={items} />)

    await user.click(screen.getByRole('button', { name: 'Acties' }))
    await user.click(screen.getByText('Notitie toevoegen'))
    await user.type(screen.getByRole('textbox'), 'Belde terug')

    const submitBtn = screen.getByRole('button', { name: 'Opslaan' })
    // Button's sm footprint (§4/§9) — never a hand-painted 8px-radius fill.
    expect(submitBtn.style.borderRadius).toBe('6px')
    expect(submitBtn.style.height).toBe('28px')
    expect(submitBtn.style.background).toBe('var(--button-fill)')

    await user.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledWith('Belde terug')
  })

  it('the multi-select confirm bar renders as a Button (sm radius/height)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const items: MenuNode[] = [{
      key: 'types', label: 'Contractvorm', multiSelect: true, onSubmit,
      options: [{ value: 'flex', label: 'Flex' }, { value: 'payroll', label: 'Payroll' }],
    }]
    render(<ActionMenu label="Acties" items={items} />)

    await user.click(screen.getByRole('button', { name: 'Acties' }))
    await user.click(screen.getByText('Contractvorm'))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Flex' }))

    const confirmBtn = screen.getByRole('button', { name: /save/i })
    // Same sm footprint as the input-node submit above — one identity, not two copies.
    expect(confirmBtn.style.borderRadius).toBe('6px')
    expect(confirmBtn.style.height).toBe('28px')

    await user.click(confirmBtn)
    expect(onSubmit).toHaveBeenCalledWith(['flex'])
  })
})
