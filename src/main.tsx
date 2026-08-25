/**
 * main.tsx — the application entry point: mounts <App/> into #root inside
 * StrictMode (surfaces unsafe effects early, §9), after pulling in the global
 * stylesheet and the i18n bootstrap so both are ready before anything renders.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
