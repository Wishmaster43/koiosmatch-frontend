import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JobsFilterBar from './JobsFilterBar'

describe('JobsFilterBar', () => {
  it('renders queue and tenant inputs and accepts filter changes', async () => {
    const user = userEvent.setup()
    const setFilter = vi.fn()
    const t = (key) => {
      const labels = {
        'jobs.filters.queue': 'Queue',
        'jobs.filters.tenant': 'Tenant',
      }
      return labels[key] || key
    }

    const { container } = render(
      <JobsFilterBar
        filters={{ queue: '', tenant: '' }}
        setFilter={setFilter}
        labels={t}
      />
    )

    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(2)
    expect(setFilter).not.toHaveBeenCalled()

    await user.type(inputs[0], 'test')
    expect(setFilter).toHaveBeenCalledWith('queue', expect.any(String))

    await user.type(inputs[1], 'test')
    expect(setFilter).toHaveBeenCalledWith('tenant', expect.any(String))
  })
})
