import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Toaster from './Toaster'
import { notifyError } from '@/lib/notify'

describe('Toaster', () => {
  it('shows a toast (role=alert) when notifyError fires', () => {
    render(<Toaster />)
    act(() => { notifyError('opslaan mislukt') })
    expect(screen.getByRole('alert')).toHaveTextContent('opslaan mislukt')
  })
})
