import { describe, expect, it } from 'vitest'
import { pickBest, scoreLocator, stableId } from './locate'
import type { Locator } from './types'

const save: Locator = { tag: 'button', label: 'Save', text: 'Save', context: 'New contact', pageX: 0.8, pageY: 0.6 }

describe('stableId', () => {
  it('keeps readable ids and drops generated ones', () => {
    expect(stableId('email')).toBe('email')
    expect(stableId('new-contact')).toBe('new-contact')
    expect(stableId('input-1234')).toBeUndefined()
    expect(stableId('ember512')).toBeUndefined()
    expect(stableId(':r3:')).toBeUndefined()
    expect(stableId('a1b2c3d4e5f6')).toBeUndefined()
  })
})

describe('pickBest', () => {
  it('picks the Save button in the right section over another Save button', () => {
    const cands: Locator[] = [
      { tag: 'button', label: 'Save', text: 'Save', context: 'Settings', pageX: 0.2, pageY: 0.9 },
      { tag: 'button', label: 'Save', text: 'Save', context: 'New contact', pageX: 0.78, pageY: 0.62 },
    ]
    expect(pickBest(save, cands)).toBe(1)
  })
  it('finds a field by its label even after the layout moved', () => {
    const field: Locator = { tag: 'input', type: 'email', label: 'Work email', name: 'email', pageX: 0.3, pageY: 0.3 }
    const cands: Locator[] = [
      { tag: 'input', type: 'password', label: 'Password', name: 'password', pageX: 0.5, pageY: 0.5 },
      { tag: 'input', type: 'email', label: 'Work email', name: 'email', pageX: 0.5, pageY: 0.35 },
    ]
    expect(pickBest(field, cands)).toBe(1)
  })
  it('gives up rather than guess when the element was renamed', () => {
    const cands: Locator[] = [{ tag: 'button', label: 'Submit', text: 'Submit', context: 'Other', pageX: 0.8, pageY: 0.6 }]
    expect(pickBest(save, cands)).toBe(-1)
  })
  it('a stable test id wins', () => {
    const s: Locator = { tag: 'button', testId: 'new-btn', label: 'New' }
    expect(scoreLocator(s, { tag: 'button', testId: 'new-btn', label: 'Create' })).toBeGreaterThan(scoreLocator(s, { tag: 'button', label: 'New' }))
  })
})
