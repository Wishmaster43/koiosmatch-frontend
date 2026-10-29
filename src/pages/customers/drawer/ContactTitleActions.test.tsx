import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactTitleActions from './ContactTitleActions'
import type { Contact } from '@/types/customer'

vi.mock('./ChangelogTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/ChangelogPopover', () => ({ default: () => null }))

const contact = { id: 'c1', customerId: 'k1', archived: false } as unknown as Contact
const two = [contact, { id: 'c2' } as unknown as Contact]

function setup(over: Partial<React.ComponentProps<typeof ContactTitleActions>> = {}) {
  const h = { onMerge: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn(), onErase: vi.fn() }
  render(<ContactTitleActions contact={contact} existing={two} canMerge canErase archiving={false} t={k => k} {...h} {...over} />)
  return h
}

describe('ContactTitleActions', () => {
  it('calls each handler from its button', async () => {
    const h = setup()
    await userEvent.click(screen.getByLabelText('contacts.merge.title'))
    await userEvent.click(screen.getByLabelText('contacts.detail.archiveContact'))
    await userEvent.click(screen.getByLabelText('common:delete'))
    await userEvent.click(screen.getByLabelText('contacts.detail.erasePerson'))
    expect(h.onMerge).toHaveBeenCalledTimes(1)
    expect(h.onArchive).toHaveBeenCalledTimes(1)
    expect(h.onDelete).toHaveBeenCalledTimes(1)
    expect(h.onErase).toHaveBeenCalledTimes(1)
  })

  it('hides Merge without canMerge or with only one contact', () => {
    setup({ canMerge: false })
    expect(screen.queryByLabelText('contacts.merge.title')).toBeNull()
  })

  it('hides Merge when there is no second contact', () => {
    setup({ existing: [contact] })
    expect(screen.queryByLabelText('contacts.merge.title')).toBeNull()
  })

  it('hides Archive and Erase on an archived contact', () => {
    setup({ contact: { ...contact, archived: true } as unknown as Contact })
    expect(screen.queryByLabelText('contacts.detail.archiveContact')).toBeNull()
    expect(screen.queryByLabelText('contacts.detail.erasePerson')).toBeNull()
  })

  it('hides Erase without privacy.erase', () => {
    setup({ canErase: false })
    expect(screen.queryByLabelText('contacts.detail.erasePerson')).toBeNull()
  })
})
