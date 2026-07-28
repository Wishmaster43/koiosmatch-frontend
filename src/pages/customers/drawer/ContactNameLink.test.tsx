/**
 * Clicking a contact anywhere in the customer drawer must land on THAT contact's own
 * drill-down (Danny 28-07: "ik wil dat ik vanuit de locatie ook door kan klikken op een
 * contactpersoon en dat ik het scherm krijg zoals contactpersonen").
 *
 * Two halves are pinned here:
 *  1. ContactNameLink itself — links when it can, degrades to plain text when it cannot.
 *  2. SubEntityTab's `openId` — the seam that turns that click into an OPEN detail view.
 *     A test that only proved the callback fired would prove nothing about the seam (§13).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactNameLink from './ContactNameLink'
import SubEntityTab from './SubEntityTab'
import type { Column } from '@/components/ui/DataTable'

describe('ContactNameLink', () => {
  it('opens the given contact when clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<ContactNameLink name="Joost de Boer" id="c-1" onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Joost de Boer' }))
    expect(onOpen).toHaveBeenCalledWith('c-1')
  })

  // The on-site contact is free text: an unresolved name must NOT look clickable.
  it('renders plain text — not a link — when there is no id to open', () => {
    render(<ContactNameLink name="Onbekend Persoon" id={null} onOpen={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Onbekend Persoon')).toBeInTheDocument()
  })

  it('renders plain text when no handler is wired', () => {
    render(<ContactNameLink name="Joost de Boer" id="c-1" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

interface Row { id: string; name: string }
const columns: Column<Row>[] = [{ key: 'name', header: 'Naam', render: r => r.name }]
const rows: Row[] = [{ id: 'c-1', name: 'Eva Bos' }, { id: 'c-2', name: 'Joost de Boer' }]

describe('SubEntityTab · openId (the cross-tab jump seam)', () => {
  const renderDetail = (r: Row) => <div>detail:{r.name}</div>

  it('opens that row\'s detail straight away when mounted with an openId', () => {
    render(<SubEntityTab items={rows} columns={columns} openId="c-2" renderDetail={renderDetail} backLabel="Terug" />)
    expect(screen.getByText('detail:Joost de Boer')).toBeInTheDocument()
  })

  it('switches to the newly requested contact when openId changes', () => {
    const { rerender } = render(<SubEntityTab items={rows} columns={columns} openId="c-1" renderDetail={renderDetail} backLabel="Terug" />)
    expect(screen.getByText('detail:Eva Bos')).toBeInTheDocument()
    rerender(<SubEntityTab items={rows} columns={columns} openId="c-2" renderDetail={renderDetail} backLabel="Terug" />)
    expect(screen.getByText('detail:Joost de Boer')).toBeInTheDocument()
  })

  // The id stays set after the jump; pressing Terug must still return to the list
  // instead of the same id immediately reopening the detail.
  it('lets the user go back to the list afterwards', async () => {
    const user = userEvent.setup()
    render(<SubEntityTab items={rows} columns={columns} openId="c-2" renderDetail={renderDetail} backLabel="Terug" />)
    await user.click(screen.getByRole('button', { name: /Terug/ }))
    expect(screen.queryByText('detail:Joost de Boer')).toBeNull()
    expect(screen.getByText('Eva Bos')).toBeInTheDocument()
  })

  it('shows the plain list when no openId is given', () => {
    render(<SubEntityTab items={rows} columns={columns} renderDetail={renderDetail} backLabel="Terug" />)
    expect(screen.queryByText(/^detail:/)).toBeNull()
  })
})
