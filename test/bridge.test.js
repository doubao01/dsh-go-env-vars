import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderBashrcBlock, renderBridge } from '../lib/bridge.js'

describe('renderBridge', () => {
  it('re-exports each variable under its plain name', () => {
    const script = renderBridge({ GITHUB_TOKEN: { value: 'abc' } })
    assert.match(script, /export GITHUB_TOKEN="\$\{DSH_VAR_GITHUB_TOKEN\}"/)
  })

  it('guards on the variable being set', () => {
    const script = renderBridge({ A: { value: 'x' } })
    assert.match(script, /if \[ -n "\$\{DSH_VAR_A:-\}" \]; then/)
  })

  it('handles several variables in sorted order', () => {
    const script = renderBridge({ ZED: { value: '1' }, ALPHA: { value: '2' } })
    assert.ok(script.indexOf('DSH_VAR_ALPHA') < script.indexOf('DSH_VAR_ZED'))
  })

  it('skips empty values', () => {
    const script = renderBridge({ EMPTY: { value: '' } })
    assert.doesNotMatch(script, /export EMPTY/)
    assert.match(script, /No variables stored/)
  })

  it('writes a header explaining how to load it', () => {
    const script = renderBridge({ A: { value: 'x' } })
    assert.match(script, /\. ~\/\.dsh\/dsh-go\/env\.sh/)
    assert.match(script, /bashrc/)
  })

  it('never interpolates the value into the script', () => {
    // The value travels through ${DSH_VAR_*}, not a literal.
    const script = renderBridge({ A: { value: 'secret-value-xyz' } })
    assert.doesNotMatch(script, /secret-value-xyz/)
  })
})

describe('renderBashrcBlock', () => {
  it('wraps the source line in markers', () => {
    const block = renderBashrcBlock()
    assert.match(block, /^# >>> dsh-go-env-vars >>>/m)
    assert.match(block, /# <<< dsh-go-env-vars <<<$/m)
  })

  it('loads the bridge only when it exists', () => {
    assert.match(renderBashrcBlock(), /\[ -r ".*env\.sh" \] && \. ".*env\.sh"/)
  })
})
