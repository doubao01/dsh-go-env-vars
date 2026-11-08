import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readField, readFlag } from '../lib/form.js'

describe('readField', () => {
  it('reads the payload the app actually sends', () => {
    // Shape observed from dsh-go 1.0.12: the binding path is the literal key.
    const payload = { values: { 'data.newName': 'abc', 'data.newValue': '1244' } }
    assert.equal(readField(payload, ['newName']), 'abc')
    assert.equal(readField(payload, ['newValue']), '1244')
  })

  it('reads flat keys', () => {
    assert.equal(readField({ newName: 'A' }, ['newName']), 'A')
  })

  it('reads nested envelopes', () => {
    assert.equal(readField({ data: { newName: 'A' } }, ['newName']), 'A')
    assert.equal(readField({ values: { data: { newName: 'A' } } }, ['newName']), 'A')
  })

  it('prefers the first listed key', () => {
    assert.equal(readField({ name: 'second', newName: 'first' }, ['newName', 'name']), 'first')
  })

  it('stringifies primitives', () => {
    assert.equal(readField({ count: 7 }, ['count']), '7')
    assert.equal(readField({ on: true }, ['on']), 'true')
  })

  it('returns undefined when absent', () => {
    assert.equal(readField({}, ['newName']), undefined)
    assert.equal(readField(undefined, ['newName']), undefined)
    assert.equal(readField(null, ['newName']), undefined)
    assert.equal(readField('text', ['newName']), undefined)
  })

  it('stops at the depth limit instead of looping', () => {
    let deep = { newName: 'found' }
    for (let i = 0; i < 20; i += 1) deep = { child: deep }
    assert.equal(readField(deep, ['newName']), undefined)
  })
})

describe('readFlag', () => {
  it('reads booleans', () => {
    assert.equal(readFlag({ privacy: 'true' }, ['privacy']), true)
    assert.equal(readFlag({ privacy: 'false' }, ['privacy']), false)
    assert.equal(readFlag({ privacy: true }, ['privacy']), true)
  })

  it('reports absence distinctly from false', () => {
    assert.equal(readFlag({}, ['privacy']), undefined)
  })
})
