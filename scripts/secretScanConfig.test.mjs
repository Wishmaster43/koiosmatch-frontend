/**
 * Q-009 (FE twin of the API repo's SecretScanConfigTest): the secret-scan and semgrep CI
 * configuration keeps its SHAPE. No gitleaks or semgrep binary runs here (the first CI run is the
 * measurement); this guards the things a careless edit would silently weaken: an allow-list entry
 * without AND + anchored path, an unpinned image, a scan that no longer fails on ERROR severity.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

describe('secret scan configuration (Q-009, FE twin)', () => {
  it('.gitleaks.toml extends the default ruleset and every allow-list entry is AND-keyed on an anchored path plus a regex', () => {
    const toml = read('.gitleaks.toml')
    expect(toml).toMatch(/\[extend\]\s*\n\s*useDefault = true/)
    const blocks = toml.split('[[allowlists]]').slice(1)
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) {
      expect(b).toMatch(/condition = "AND"/)
      expect(b).toMatch(/paths = \['''\^.*\$'''\]/)
      expect(b).toMatch(/regexes = \['''.+'''\]/)
      expect(b).toMatch(/description = ".+"/)
    }
  })

  it('secret-scan.yml pins the gitleaks image by digest, checks out the full history and is never cancelled by a newer push', () => {
    const yml = read('.github/workflows/secret-scan.yml')
    expect(yml).toMatch(/ghcr\.io\/gitleaks\/gitleaks:v8\.\d+\.\d+@sha256:[0-9a-f]{64}/)
    expect((yml.match(/fetch-depth: 0/g) ?? []).length).toBe(2)
    expect(yml).toMatch(/cancel-in-progress: false/)
    expect(yml).toMatch(/--config \/repo\/\.gitleaks\.toml/)
    expect(yml).toMatch(/--log-opts=--all/)
    expect(yml).toMatch(/schedule:/)
  })

  it('ci.yml runs a pinned semgrep that fails on ERROR severity over the JavaScript/TypeScript/React rulesets', () => {
    const yml = read('.github/workflows/ci.yml')
    expect(yml).toMatch(/semgrep\/semgrep:1\.\d+\.\d+@sha256:[0-9a-f]{64}/)
    expect(yml).toMatch(/semgrep scan --error --severity ERROR/)
    for (const ruleset of ['p/javascript', 'p/typescript', 'p/react', 'p/security-audit', 'p/secrets']) expect(yml).toContain(`--config ${ruleset}`)
  })

  it('.semgrepignore excludes third-party, build output and the generated API types', () => {
    const ignore = read('.semgrepignore')
    for (const line of ['node_modules/', 'dist/', 'coverage/', 'src/types/api-generated.ts']) expect(ignore).toContain(line)
  })
})
