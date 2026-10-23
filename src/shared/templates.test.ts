import { describe, expect, it } from 'vitest'
import { markdownWithImages, shotsByNumber } from './export'
import { buildSop, buildTraining, stepNumbers } from './templates'
import type { Guide, Step } from './types'

const step = (id: string, title: string, over: Partial<Step> = {}): Step => ({
  id,
  kind: 'step',
  title,
  annotations: [],
  createdAt: 0,
  url: 'https://crm.example.com/contacts',
  imageId: 'img-' + id,
  ...over,
})

const guide: Guide = {
  id: 'g',
  title: 'Add a contact',
  description: '',
  createdAt: 0,
  updatedAt: 0,
  status: 'ready',
  docs: {},
  steps: [
    step('a', 'Click the "New contact" button'),
    { id: 'h', kind: 'heading', title: 'Details', annotations: [], createdAt: 0 },
    { id: 'n', kind: 'note', noteStyle: 'warning', title: 'Check for duplicates first.', annotations: [], createdAt: 0 },
    step('b', 'Type "Jordan" into the "Name" field', { action: 'type', target: { tag: 'input', label: 'Name' } }),
    step('c', 'Click the "Save" button'),
  ],
}

describe('stepNumbers', () => {
  it('numbers only real steps', () => {
    expect([...stepNumbers(guide).entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })
})

describe('buildSop', () => {
  const md = buildSop(guide)
  it('has the standard SOP sections', () => {
    for (const h of ['## 1. Purpose', '## 2. Scope', '## 3. Prerequisites', '## 4. Procedure', '## 5. Expected result', '## 6. Revision history']) {
      expect(md).toContain(h)
    }
  })
  it('places a screenshot after each step, plus headings and notes', () => {
    expect(md).toContain('**Step 2.** Type "Jordan" into the "Name" field\n\n{{screenshot:2}}')
    expect(md).toContain('### Details')
    expect(md).toContain('> **Warning:** Check for duplicates first.')
    expect(md).toContain('`crm.example.com`')
    expect(md).toContain('**Name**')
  })
})

describe('buildTraining', () => {
  const md = buildTraining(guide)
  it('has objectives, practice checklist, quiz and quick reference', () => {
    expect(md).toContain("## What you'll learn")
    expect(md).toContain('- [ ] Click the "Save" button')
    expect(md).toContain('## Check your understanding')
    expect(md).toContain('<details><summary>Answer key</summary>')
    expect(md).toContain('3. Click the "Save" button')
  })
})

describe('screenshot placeholders', () => {
  it('maps step numbers to images and swaps placeholders', () => {
    const shots = shotsByNumber(guide, { a: 'data:a', c: 'data:c' })
    expect(shots).toEqual({ 1: 'data:a', 3: 'data:c' })
    const md = 'One\n{{screenshot:1}}\nTwo\n  {{ screenshot : 2 }}  \nThree\n{{screenshot:3}}'
    expect(markdownWithImages(md, shots)).toBe('One\n![Step 1](data:a)\nTwo\n\nThree\n![Step 3](data:c)')
  })
})
