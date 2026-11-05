import { describe, expect, it } from 'vitest'
import { attemptOf, certificateHtml, duration, resultLine, verdict } from './practice'
import type { GuideMeState } from './types'

const st = (over: Partial<GuideMeState>): GuideMeState => ({
  guideId: 'g',
  title: 'Add a contact',
  tabId: 1,
  index: 5,
  steps: [
    { kind: 'step', title: 'Go to the page', action: 'navigate', hasImage: false },
    { kind: 'step', title: 'Click New', action: 'click', hasImage: true },
    { kind: 'note', title: 'Tip', hasImage: false },
    { kind: 'step', title: 'Type the name', action: 'type', hasImage: true },
    { kind: 'step', title: 'Click Save', action: 'click', hasImage: true },
  ],
  practice: true,
  startedAt: 1000,
  learner: 'Priya',
  results: { 1: 'found', 3: 'found', 4: 'found' },
  hints: [3],
  mistakes: 1,
  ...over,
})

describe('practice results', () => {
  it('counts steps done alone, hints and mistakes', () => {
    const a = attemptOf(st({}), 131000)
    expect(a).toMatchObject({ learner: 'Priya', steps: 3, onOwn: 2, hints: 1, mistakes: 1, skipped: 0, completed: true, durationMs: 130000 })
    expect(resultLine(a)).toBe('Completed in 2:10 · 2 of 3 steps on their own · 1 hint · 1 mistake')
    expect(verdict(a)).toBe('Done with some help')
  })
  it('says when it was all done alone', () => {
    const a = attemptOf(st({ hints: [], mistakes: 0 }), 31000)
    expect(verdict(a)).toBe('Done on their own, without mistakes')
    expect(duration(a.durationMs)).toBe('30s')
  })
  it('notices skipped and unfinished runs', () => {
    const a = attemptOf(st({ index: 3, results: { 1: 'skipped' }, hints: [] }), 5000)
    expect(a.completed).toBe(false)
    expect(a.skipped).toBe(1)
    expect(verdict(a)).toBe('Not finished')
  })
  it('makes a certificate with the learner and result, escaping text', () => {
    const html = certificateHtml(attemptOf(st({ learner: 'Sam <b>' }), 131000), 'Add a "contact"')
    expect(html).toContain('Sam &lt;b&gt;')
    expect(html).toContain('Add a &quot;contact&quot;')
    expect(html).toContain('2 of 3')
  })
  it('leaves out steps that were already done before practice got to them', () => {
    const a = attemptOf(st({ already: [1], results: { 1: 'skipped', 3: 'found', 4: 'found' }, hints: [], mistakes: 0 }), 11000)
    expect(a.steps).toBe(2)
    expect(a.onOwn).toBe(2)
    expect(a.skipped).toBe(0)
  })
})
