// The editor's building blocks for SOPs and training modules. The document is
// still saved as Markdown (exports and templates use it), so each special block
// reads and writes its own Markdown form:
//   Screenshot  →  {{screenshot:3}}
//   Callout     →  > **Tip:** Text…   (Tip, Warning or Note)
//   Answer key  →  <details><summary>Answer key</summary> … </details>
import { mergeAttributes, Node, type NodeConfig } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { AnyExtension } from '@tiptap/core'

export type CalloutKind = 'Tip' | 'Warning' | 'Note'
export const CALLOUTS: CalloutKind[] = ['Tip', 'Warning', 'Note']

export const Screenshot = Node.create({
  name: 'screenshot',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { n: { default: 1, parseHTML: (el) => Number(el.getAttribute('data-step')) || 1, renderHTML: (a) => ({ 'data-step': a.n }) } }
  },
  parseHTML() {
    return [{ tag: 'figure[data-screenshot]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-screenshot': '' })]
  },
  markdownTokenizer: {
    name: 'screenshot',
    level: 'block',
    start: (src: string) => src.indexOf('{{screenshot:'),
    tokenize(src: string) {
      const m = /^\{\{screenshot:(\d+)\}\}[ \t]*(?:\n|$)/.exec(src)
      return m ? { type: 'screenshot', raw: m[0], n: Number(m[1]) } : undefined
    },
  },
  parseMarkdown: (token, h) => h.createNode('screenshot', { n: Number((token as { n?: number }).n) || 1 }),
  renderMarkdown: (node) => `{{screenshot:${node.attrs?.n ?? 1}}}`,
})

// A coloured box: Tip, Warning or Note. The label is part of the box, not the text.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { kind: { default: 'Tip', parseHTML: (el) => el.getAttribute('data-kind') ?? 'Tip', renderHTML: (a) => ({ 'data-kind': a.kind }) } }
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout' }), 0]
  },
  markdownTokenizer: {
    name: 'callout',
    level: 'block',
    start: (src: string) => src.search(/^> \*\*(Tip|Warning|Note):\*\*/m),
    tokenize(src: string, _tokens, lexer) {
      const m = /^> \*\*(Tip|Warning|Note):\*\*[ \t]?([^\n]*)(?:\n|$)/.exec(src)
      if (!m) return undefined
      return { type: 'callout', raw: m[0], kind: m[1], text: m[2], tokens: lexer.inlineTokens(m[2]) }
    },
  },
  parseMarkdown: (token, h) => h.createNode('callout', { kind: (token as { kind?: string }).kind ?? 'Tip' }, h.parseInline(token.tokens ?? [])),
  renderMarkdown: (node, h) => `> **${node.attrs?.kind ?? 'Tip'}:** ${h.renderChildren(node.content ?? [])}`,
})

// A fold-out section (the training quiz's answer key). Edited open; folds in exports.
export const AnswerKey = Node.create({
  name: 'answerKey',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { summary: { default: 'Answer key', parseHTML: (el) => el.getAttribute('data-summary') ?? 'Answer key', renderHTML: (a) => ({ 'data-summary': a.summary }) } }
  },
  parseHTML() {
    return [{ tag: 'section[data-answer-key]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-answer-key': '', class: 'answer-key' }), 0]
  },
  markdownTokenizer: {
    name: 'answerKey',
    level: 'block',
    start: (src: string) => src.indexOf('<details>'),
    tokenize(src: string, _tokens, lexer) {
      const m = /^<details><summary>([^<]*)<\/summary>\n([\s\S]*?)\n?<\/details>[ \t]*(?:\n|$)/.exec(src)
      if (!m) return undefined
      return { type: 'answerKey', raw: m[0], summary: m[1], tokens: lexer.blockTokens(m[2].trim()) }
    },
  },
  parseMarkdown: (token, h) => h.createNode('answerKey', { summary: (token as { summary?: string }).summary ?? 'Answer key' }, h.parseChildren(token.tokens ?? [])),
  renderMarkdown: (node, h) => `<details><summary>${node.attrs?.summary ?? 'Answer key'}</summary>\n\n${h.renderChildren(node.content ?? [], '\n\n')}\n\n</details>`,
})

type View = NodeConfig['addNodeView']

// Everything the document editor needs. The app passes its own views for the
// screenshot and callout blocks, and any UI-only extensions in `extra`.
export function docExtensions(opts: { shotView?: View; calloutView?: View; extra?: AnyExtension[] } = {}): AnyExtension[] {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true }, codeBlock: false }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: false }),
    opts.shotView ? Screenshot.extend({ addNodeView: opts.shotView }) : Screenshot,
    opts.calloutView ? Callout.extend({ addNodeView: opts.calloutView }) : Callout,
    AnswerKey,
    Markdown,
    ...(opts.extra ?? []),
  ]
}
