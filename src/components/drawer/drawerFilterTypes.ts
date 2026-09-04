// Extracted from DrawerFilterMenu (SIZE-SPLIT-B, zero behaviour change): the
// per-row filter config shapes. See DrawerFilterMenu.tsx's module doc for the
// full design rationale.
import type { ReactNode } from 'react'

export interface DrawerFilterOption { value: string; label: string }

// Single-select row (notes type/channel, document type) — the house searchable
// SelectMenu, '' = no filter. Mirrors SelectMenu's own value/onChange contract,
// so this component is a thin composer around it, never a second implementation.
export interface DrawerSingleFilterConfig {
  type: 'single'
  key: string
  // Field label shown above its control inside the panel (already translated by the host).
  label: ReactNode
  value: string
  options: DrawerFilterOption[]
  onChange: (value: string) => void
  // The dropdown's own "all" placeholder/option label (e.g. "Alle types").
  allLabel: string
}

// Multi-select row (task status/type/priority, …) — an INLINE searchable
// checklist, deliberately never a nested popover: the house SearchSelect (the
// existing multi-select control) renders its dropdown via `createPortal` into
// `document.body`, which would sit OUTSIDE this panel's own DOM subtree — this
// panel's outside-click listener (below) would then see every option click as
// "outside" and close the whole menu before `onToggle` could even register the
// pick. Rendering the checklist inline (no portal) keeps every click inside the
// panel's own subtree, side-stepping that class of bug entirely.
export interface DrawerMultiFilterConfig {
  type: 'multi'
  key: string
  label: ReactNode
  selected: string[]
  options: DrawerFilterOption[]
  onToggle: (value: string) => void
  // Placeholder/aria-label for this row's own search box (already translated).
  searchPlaceholder: string
  // "No options" copy for an empty vocabulary (already translated).
  noResultsLabel: string
}

// Range row (P8-more-filters, batch 8: "Uren per week") — a two-thumb Slider,
// mirrors VacancySearchFilters' own hours row. `active`/`onReset` are supplied by
// the HOST rather than derived here: a range's "off" position is whatever the
// host's own domain considers unbounded (e.g. [0, max] for hours), which only the
// host knows — the shared component stays generic over that choice.
export interface DrawerRangeFilterConfig {
  type: 'range'
  key: string
  label: ReactNode
  value: [number, number]
  max: number
  step?: number
  onChange: (next: [number, number]) => void
  // Formatted numeric readout beside the slider (already localized, e.g. "0–40").
  valueLabel: string
  ariaLabels: [string, string]
  // Whether the current value narrows anything (drives the badge + clear-all).
  active: boolean
  // Reset THIS row back to its host-defined "off" value — used by clear-all.
  onReset: () => void
}

// Date row (P8-more-filters: "Inzetbaar vanaf") — the shared react-datepicker
// convention (DD-MM-YYYY, §4), '' = no filter. Renders via the app-wide
// #datepicker-portal DOM node (index.html) instead of inline, so the calendar
// popper is never clipped by this panel's own bounds — see the outside-click
// listener below for the whitelist that keeps that portal from closing the panel.
export interface DrawerDateFilterConfig {
  type: 'date'
  key: string
  label: ReactNode
  value: string
  onChange: (next: string) => void
  placeholder: string
}

// Toggle row (K-288, linked-notes "Alleen directe notities" switch) — a single
// boolean, the shared Toggle atom. Minimal by design: no options/all-label, just
// value + onChange, mirrored on the NoteFeedList section's own Toggle usage.
export interface DrawerToggleFilterConfig {
  type: 'toggle'
  key: string
  label: ReactNode
  value: boolean
  onChange: (value: boolean) => void
  // Accessible name for the switch itself (label above is visual only — Toggle
  // has no <label> association of its own, mirrors every other Toggle call site).
  ariaLabel: string
}

export type DrawerFilterConfig = DrawerSingleFilterConfig | DrawerMultiFilterConfig | DrawerRangeFilterConfig | DrawerDateFilterConfig | DrawerToggleFilterConfig
