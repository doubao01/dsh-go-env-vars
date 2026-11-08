import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseState } from '../lib/store.js'

describe('parseState', () => {
  it('reads the current wrapped shape', () => {
    const state = parseState({ meta: { privacy: false }, vars: { A: { value: 'x', note: 'n' } } })
    assert.deepEqual(state, { privacy: false, vars: { A: { value: 'x', note: 'n' } } })
  })

  it('defaults a missing note to an empty string', () => {
    const state = parseState({ meta: {}, vars: { A: { value: 'x' } } })
    assert.deepEqual(state.vars.A, { value: 'x', note: '' })
  })

  it('defaults privacy to on', () => {
    assert.equal(parseState({ meta: {}, vars: {} }).privacy, true)
  })

  it('reads the legacy bare map so an upgrade keeps values', () => {
    const state = parseState({ GITHUB_TOKEN: 'abc', OTHER: { value: 'v' } })
    assert.deepEqual(state.vars, {
      GITHUB_TOKEN: { value: 'abc', note: '' },
      OTHER: { value: 'v', note: '' },
    })
    assert.equal(state.privacy, true)
  })

  it('drops entries without a string value', () => {
    assert.deepEqual(parseState({ meta: {}, vars: { A: 1, B: null, C: 'ok' } }).vars, {
      C: { value: 'ok', note: '' },
    })
  })

  it('falls back to empty for junk', () => {
    for (const junk of [null, undefined, 42, 'text', []]) {
      const state = parseState(junk)
      assert.deepEqual(state.vars, {})
      assert.equal(state.privacy, true)
    }
  })
})
