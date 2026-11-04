// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { buildSop, buildTraining } from '../../shared/templates'
import type { Guide } from '../../shared/types'
import { docExtensions } from './blocks'

const guide: Guide = {
  id: 'g1',
  title: 'Add a contact',
  description: '',
  createdAt: 0,
  updatedAt: 0,
  status: 'ready',
  docs: {},
  steps: [
    { id: 'a', kind: 'step', title: 'Go to app.example.com/contacts', annotations: [], createdAt: 0, action: 'navigate', url: 'https://app.example.com/contacts', imageId: 'i1' },
    { id: 'b', kind: 'note', title: 'Search first so you don\'t add a duplicate.', annotations: [], createdAt: 0, noteStyle: 'tip' },
    { id: 'c', kind: 'heading', title: 'Fill in the details', annotations: [], createdAt: 0 },
    { id: 'd', kind: 'step', title: 'Type "Jordan" into the "Name" field', annotations: [], createdAt: 0, action: 'type', target: { tag: 'input', label: 'Name' }, imageId: 'i2' },
    { id: 'e', kind: 'step', title: 'Click the "Save" button', annotations: [], createdAt: 0, action: 'click', imageId: 'i3' },
  ],
} as Guide

const roundTrip = (md: string) => {
  const editor = new Editor({ extensions: docExtensions(), content: md, contentType: 'markdown' })
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}
// Blank lines and trailing spaces don't change how the document reads or exports.
// Table cell padding and _italic_ vs *italic* are the same Markdown.
const norm = (s: string) =>
  s
    .replace(/ *\| */g, '|')
    .replace(/\|-+/g, '|-')
    .replace(/(^|[^\w*])_([^_\n]+)_(?!\w)/g, '$1*$2*')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

describe('document editor keeps the Markdown as it was', () => {
  it('SOP template', () => {
    const md = buildSop(guide)
    expect(norm(roundTrip(md))).toBe(norm(md))
  })
  it('training template', () => {
    const md = buildTraining(guide)
    expect(norm(roundTrip(md))).toBe(norm(md))
  })
  it('custom blocks', () => {
    const md = '{{screenshot:3}}\n\n> **Warning:** Don\'t press **Delete**.\n\n<details><summary>Answer key</summary>\n\n1. Save it\n\n</details>'
    expect(norm(roundTrip(md))).toBe(norm(md))
  })
})
