import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { maskValue, message, langOf } from '../lib/text.js'

describe('langOf', () => {
  it('defaults to Chinese', () => {
    assert.equal(langOf(undefined), 'zh')
    assert.equal(langOf('zh-CN'), 'zh')
  })

  it('recognizes English tags', () => {
    assert.equal(langOf('en'), 'en')
    assert.equal(langOf('en-US'), 'en')
  })
})

describe('message', () => {
  it('returns both languages', () => {
    assert.equal(message('zh', 'nameFirst'), '先填名称')
    assert.equal(message('en', 'nameFirst'), 'Enter a name first')
  })
})

describe('maskValue', () => {
  it('hides short values entirely', () => {
    assert.equal(maskValue(''), '')
    assert.equal(maskValue('abc'), '***')
    assert.equal(maskValue('abcdefg'), '*******')
  })

  it('keeps a three-character hint for long values', () => {
    assert.equal(maskValue('ghp_1234567890'), 'ghp********')
  })

  it('never reveals more than three characters', () => {
    const masked = maskValue('sk-' + 'x'.repeat(60))
    assert.ok(masked.startsWith('sk-'))
    assert.ok(!masked.slice(3).includes('x'))
  })
})
