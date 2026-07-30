import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '@/source/bundled/examples'
import { ScriptRegistry } from '@/registry/registry'
import { enrichTransaction } from '@/decode/enrich'
import { buildFlowSvg } from './flowSvg'

describe('buildFlowSvg', () => {
  const registry = new ScriptRegistry('mainnet')
  const ex = EXAMPLES[0]!.transaction
  const { transaction, capacity } = enrichTransaction(ex, registry)
  const svg = buildFlowSvg(transaction, capacity)

  it('produces a well-formed, self-contained svg', () => {
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    // no external references (namespace URI aside) and no script injection
    expect(svg).not.toMatch(/href=|xlink:href|<image|<script/)
    expect(svg).toContain('ckb-viz')
    expect(svg).toContain('in →')
  })

  it('escapes on-chain text rather than injecting it as markup', () => {
    const evil = { ...transaction, hash: '0x"><script>alert(1)</script>' }
    const out = buildFlowSvg(evil, capacity)
    expect(out).not.toContain('<script>alert')
    expect(out).toContain('&lt;script&gt;')
  })
})
