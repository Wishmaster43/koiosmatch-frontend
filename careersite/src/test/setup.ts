import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmounts any rendered component tree after each test. No global `afterEach`
// is injected (vite.config.ts sets `globals: false`), so this has to be explicit.
afterEach(() => {
  cleanup()
})
