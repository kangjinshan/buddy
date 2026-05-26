import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function readSources(dir: string): string {
  return readdirSync(dir).map((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return readSources(path)
    if (!path.endsWith('.ts') && !path.endsWith('.tsx')) return ''
    return readFileSync(path, 'utf8')
  }).join('\n')
}

describe('native runtime source', () => {
  it('does not start buddy-python or call local buddy HTTP', () => {
    const source = readSources(join(process.cwd(), 'src'))

    expect(source).not.toContain("spawn('buddy'")
    expect(source).not.toContain('buddy serve')
    expect(source).not.toContain('127.0.0.1:8765')
    expect(source).not.toContain("baseURL: '/api'")
    expect(source).not.toContain('axios')
  })
})
