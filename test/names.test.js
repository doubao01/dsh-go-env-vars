import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { envNameOf, MAX_NAME_LENGTH, normalizeName, PREFIX, RESERVED, validateName } from '../lib/names.js'

describe('normalizeName', () => {
  it('trims and uppercases', () => {
    assert.equal(normalizeName('  github_token  '), 'GITHUB_TOKEN')
  })

  it('coerces non-strings', () => {
    assert.equal(normalizeName(undefined), '')
    assert.equal(normalizeName(null), '')
    assert.equal(normalizeName(42), '42')
  })
})

describe('validateName', () => {
  it('accepts POSIX-shaped names', () => {
    for (const name of ['A', 'GITHUB_TOKEN', 'TOKEN_1', 'X_9']) {
      assert.equal(validateName(name), null, name)
    }
  })

  it('rejects an empty name', () => {
    assert.equal(validateName(''), 'empty')
  })

  it('rejects names past the length limit', () => {
    assert.equal(validateName('A'.repeat(MAX_NAME_LENGTH)), null)
    assert.equal(validateName('A'.repeat(MAX_NAME_LENGTH + 1)), 'too-long')
  })

  it('rejects characters a shell cannot reference', () => {
    for (const name of ['MY-TOKEN', 'MY TOKEN', '1ABC', '_LEAD', '中文', 'A.B']) {
      assert.equal(validateName(name), 'bad-charset', name)
    }
  })

  it('rejects keys the engine owns', () => {
    for (const reserved of RESERVED) {
      assert.equal(validateName(reserved.slice(PREFIX.length)), 'reserved')
    }
  })
})

describe('envNameOf', () => {
  it('prefixes the managed namespace', () => {
    assert.equal(envNameOf('GITHUB_TOKEN'), 'DSH_VAR_GITHUB_TOKEN')
  })
})
