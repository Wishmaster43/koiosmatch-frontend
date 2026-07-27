/**
 * SubEntityTab · "+" trigger (Danny 27-07 consistency sweep) — the shared shell
 * behind Locaties/Afdelingen/Contactpersonen used to hand-roll a solid-fill "+"
 * button; it is now the shared DrawerAddButton, same onClick (`onAdd`).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubEntityTab from './SubEntityTab'
import type { Column } from '@/components/ui/DataTable'

interface Item { id: string; name: string }
const columns: Column<Item>[] = [{ key: 'name', header: 'Name', render: it => it.name }]

describe('SubEntityTab · "+" trigger (Danny 27-07: house button)', () => {
  it('renders no add trigger when the host omits onAdd', () => {
    render(<SubEntityTab<Item> items={[]} columns={columns} renderDetail={() => null} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onAdd when the house button is clicked', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<SubEntityTab<Item> items={[]} columns={columns} addLabel="locations.add" onAdd={onAdd} renderDetail={() => null} />)
    await user.click(screen.getByRole('button', { name: 'locations.add' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
