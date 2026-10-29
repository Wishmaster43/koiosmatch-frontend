import { describe, it, expect } from 'vitest'
import { resolveMapTiles } from './mapTiles'

describe('resolveMapTiles', () => {
  it('falls back to OSM while no provider is configured', () => {
    const t = resolveMapTiles({})
    expect(t.url).toContain('tile.openstreetmap.org')
    expect(t.origin).toBe('https://*.tile.openstreetmap.org')
    expect(t.attribution).toContain('OpenStreetMap')
  })

  it('uses the configured provider, with a wildcard origin for a {s} subdomain', () => {
    const t = resolveMapTiles({ VITE_MAP_TILE_URL: 'https://{s}.tiles.example.eu/{z}/{x}/{y}.png?key=k', VITE_MAP_TILE_ATTRIBUTION: 'Example' })
    expect(t).toEqual({ url: 'https://{s}.tiles.example.eu/{z}/{x}/{y}.png?key=k', attribution: 'Example', origin: 'https://*.tiles.example.eu' })
  })

  it('keeps the OSM credit when a provider URL is set without attribution', () => {
    expect(resolveMapTiles({ VITE_MAP_TILE_URL: 'https://tiles.example.eu/{z}/{x}/{y}.png' }).attribution).toContain('OpenStreetMap')
  })

  it('derives a plain origin from a template without {s}', () => {
    expect(resolveMapTiles({ VITE_MAP_TILE_URL: 'https://tiles.example.eu/{z}/{x}/{y}.png' }).origin).toBe('https://tiles.example.eu')
  })
})
