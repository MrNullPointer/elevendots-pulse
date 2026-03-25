import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('theme bootstrap script', () => {
  it('sets the theme before React mounts', () => {
    const html = readFileSync('index.html', 'utf8')

    expect(html).toContain("localStorage.getItem('theme')")
    expect(html).toContain("document.documentElement.setAttribute('data-theme', theme)")
  })
})
