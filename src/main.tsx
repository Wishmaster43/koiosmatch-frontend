/**
 * main.tsx — the application entry point: mounts <App/> into #root inside
 * StrictMode (surfaces unsafe effects early, §9), after pulling in the global
 * stylesheet and the i18n bootstrap so both are ready before anything renders.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ready } from './i18n'
import App from './App'

// Waits for the active (non-fallback) locale's lazily-loaded bundles before the
// first render, so a returning non-nl user never sees a raw key flash on boot
// (§9 bundle discipline: nl loads eagerly, every other language is a dynamic
// import awaited here — a no-op promise for nl users).
// A failed bundle fetch must never leave a blank page: render anyway and let i18next
// fall back to nl for the keys that did not arrive.
const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
ready.then(render, render)
