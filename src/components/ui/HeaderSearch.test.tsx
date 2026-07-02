import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HeaderSearch from './HeaderSearch'

describe('HeaderSearch', () => {
  // Typing fires onSearch once, debounced, with the trimmed query.
  it('fires onSearch (debounced, trimmed) after typing', async () => {
    const onSearch = vi.fn()
    render(<HeaderSearch onSearch={onSearch} placeholder="Zoeken" debounceMs={10} />)
    fireEvent.change(screen.getByPlaceholderText('Zoeken'), { target: { value: '  Ada  ' } })
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Ada'))
  })

  // The clear button empties the input and reports an empty query.
  it('clears the input via the clear button', async () => {
    const onSearch = vi.fn()
    render(<HeaderSearch onSearch={onSearch} placeholder="Zoeken" debounceMs={10} />)
    const input = screen.getByPlaceholderText('Zoeken') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button'))
    expect(input.value).toBe('')
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith(''))
  })
})
