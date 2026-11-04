// Edit an SOP or training module the way it looks, like a normal document.
// Saved as Markdown behind the scenes (see ../doc/blocks.ts), so exports and
// templates are unchanged.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type ReactNodeViewProps } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import DragHandle from '@tiptap/extension-drag-handle-react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CALLOUTS, docExtensions, type CalloutKind } from '../doc/blocks'
import { Icon } from '../ui'

interface Ctx {
  shots: Record<number, string>
  titles: Record<number, string>
  onAnnotate?: (n: number) => void
  pick: (current?: number) => Promise<number | null>
}
const DocCtx = createContext<Ctx>({ shots: {}, titles: {}, pick: async () => null })

// Template blanks like "_Add owner_" are highlighted until someone fills them in.
const FILL_IN = /^(add|fill in|enter|choose)\b/i
const isFillIn = (node: PMNode) => node.isText && node.marks.some((m) => m.type.name === 'italic') && FILL_IN.test(node.text ?? '')
function fillIns(doc: PMNode) {
  const out: { from: number; to: number }[] = []
  doc.descendants((node, pos) => {
    if (isFillIn(node)) out.push({ from: pos, to: pos + node.nodeSize })
  })
  return out
}
const FillIns = Extension.create({
  name: 'fillIns',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('fillIns'),
        props: {
          decorations: (state) => DecorationSet.create(state.doc, fillIns(state.doc).map((r) => Decoration.inline(r.from, r.to, { class: 'fill-in', title: 'Fill this in' }))),
        },
      }),
    ]
  },
})

// ---------- blocks drawn by the app ----------

function ShotView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const { shots, titles, onAnnotate, pick } = useContext(DocCtx)
  const n = Number(node.attrs.n)
  const src = shots[n]
  return (
    <NodeViewWrapper as="figure" className={`doc-shot group ${selected ? 'is-selected' : ''}`} data-drag-handle="">
      {src ? <img src={src} alt={`Screenshot for step ${n}`} draggable={false} /> : <div className="doc-shot-missing">Step {n} has no screenshot</div>}
      <figcaption contentEditable={false}>
        Step {n}
        {titles[n] ? ` · ${titles[n]}` : ''}
      </figcaption>
      <div className="doc-shot-tools" contentEditable={false}>
        <button
          type="button"
          onClick={async () => {
            const next = await pick(n)
            if (next) updateAttributes({ n: next })
          }}
        >
          <Icon name="image" className="h-3.5 w-3.5" /> Change
        </button>
        {onAnnotate && src && (
          <button type="button" onClick={() => onAnnotate(n)}>
            <Icon name="pen" className="h-3.5 w-3.5" /> Annotate
          </button>
        )}
        <button type="button" onClick={deleteNode} aria-label="Remove screenshot">
          <Icon name="trash" className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </NodeViewWrapper>
  )
}

function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  const kind = node.attrs.kind as CalloutKind
  return (
    <NodeViewWrapper className="callout" data-kind={kind}>
      <select contentEditable={false} className="callout-kind" value={kind} onChange={(e) => updateAttributes({ kind: e.target.value })} aria-label="Callout type">
        {CALLOUTS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <NodeViewContent className="callout-text" />
    </NodeViewWrapper>
  )
}

// ---------- the screenshot picker ----------

function Picker({ shots, titles, current, onPick }: { shots: Record<number, string>; titles: Record<number, string>; current?: number; onPick: (n: number | null) => void }) {
  const nums = Object.keys(shots)
    .map(Number)
    .sort((a, b) => a - b)
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-ink/40 p-6" onMouseDown={(e) => e.target === e.currentTarget && onPick(null)}>
      <div role="dialog" aria-label="Choose a screenshot" className="mx-auto max-w-4xl rounded-3xl bg-surface p-6 shadow-float">
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto text-lg font-semibold">Choose a screenshot</h2>
          <button className="icon-btn" onClick={() => onPick(null)} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {nums.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">This guide has no screenshots yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {nums.map((n) => (
              <button key={n} onClick={() => onPick(n)} className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-soft ${n === current ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}>
                <img src={shots[n]} alt="" className="aspect-[16/10] w-full bg-canvas object-cover object-top" />
                <span className="block truncate px-3 py-2 text-sm">
                  <b>Step {n}</b>
                  {titles[n] ? ` · ${titles[n]}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- toolbar pieces ----------

const Btn = ({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" title={label} aria-label={label} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm transition-colors disabled:opacity-35 ${on ? 'bg-ink text-white' : 'text-ink/75 hover:bg-raised hover:text-ink'}`}>
    {children}
  </button>
)
const Sep = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden />

function insertItems(editor: Editor, pickShot: () => void) {
  return [
    { label: 'Text', hint: 'A plain paragraph', run: () => editor.chain().focus().setParagraph().run() },
    { label: 'Heading', hint: 'A section title', run: () => editor.chain().focus().setHeading({ level: 2 }).run() },
    { label: 'Bulleted list', hint: 'A simple list', run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', hint: 'Steps in order', run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Checklist', hint: 'Boxes to tick', run: () => editor.chain().focus().toggleTaskList().run() },
    ...CALLOUTS.map((k) => ({ label: k, hint: k === 'Tip' ? 'A helpful hint' : k === 'Warning' ? 'Something to be careful about' : 'Extra information', run: () => editor.chain().focus().insertContent({ type: 'callout', attrs: { kind: k } }).run() })),
    { label: 'Screenshot', hint: "A step's screenshot", run: pickShot },
    { label: 'Table', hint: 'Rows and columns', run: () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
    { label: 'Divider', hint: 'A line across the page', run: () => editor.chain().focus().setHorizontalRule().run() },
  ]
}

function InsertMenu({ editor, pickShot, onDone }: { editor: Editor; pickShot: () => void; onDone: () => void }) {
  return (
    <div className="w-64 rounded-xl border border-line bg-surface p-1.5 shadow-float" role="menu">
      {insertItems(editor, pickShot).map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className="flex w-full flex-col rounded-lg px-3 py-1.5 text-left hover:bg-raised"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onDone()
            it.run()
          }}
        >
          <span className="text-sm font-medium">{it.label}</span>
          <span className="text-xs text-muted">{it.hint}</span>
        </button>
      ))}
    </div>
  )
}

export function DocEditor({ markdown, shots, titles, onChange, onAnnotate, readOnly }: { markdown: string; shots: Record<number, string>; titles: Record<number, string>; onChange: (md: string) => void; onAnnotate?: (n: number) => void; readOnly?: boolean }) {
  const [picker, setPicker] = useState<{ current?: number; resolve: (n: number | null) => void } | null>(null)
  const [saved, setSaved] = useState<'saved' | 'saving'>('saved')
  const [insertOpen, setInsertOpen] = useState(false)
  const [slash, setSlash] = useState(false)
  const lastEmitted = useRef(markdown)
  const hovered = useRef<{ from: number; to: number } | null>(null)
  const timer = useRef(0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const pick = (current?: number) => new Promise<number | null>((resolve) => setPicker({ current, resolve }))

  const extensions = useMemo(
    () =>
      docExtensions({
        shotView: () => ReactNodeViewRenderer(ShotView),
        calloutView: () => ReactNodeViewRenderer(CalloutView),
        extra: [FillIns],
      }),
    [],
  )

  const editor = useEditor({
    extensions,
    content: markdown,
    contentType: 'markdown',
    editable: !readOnly,
    immediatelyRender: true,
    editorProps: {
      attributes: { class: 'doc-prose', 'aria-label': 'Document' },
      // Clicking a blank ("Add owner") selects all of it, and typing replaces it
      // with plain text, not the blank's italics.
      handleClick: (view, pos) => {
        const r = fillIns(view.state.doc).find((b) => pos >= b.from && pos <= b.to)
        if (!r) return false
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, r.from, r.to)))
        return true
      },
      handleTextInput: (view, from, to, text) => {
        if (!fillIns(view.state.doc).some((b) => b.from === from && b.to === to)) return false
        const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(text))
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + text.length)))
        return true
      },
      handleKeyDown: (view, e) => {
        // "/" on an empty line opens the insert menu.
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
          const { $from, empty } = view.state.selection
          if (empty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
            setSlash(true)
            return true
          }
        }
        if (e.key === 'Escape') setSlash(false)
        return false
      },
    },
    onUpdate: ({ editor }) => {
      setSaved('saving')
      setSlash(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        const md = editor.getMarkdown()
        lastEmitted.current = md
        onChangeRef.current(md)
        setSaved('saved')
      }, 400)
    },
  })

  // A new version from outside (Rebuild from steps): replace the content as one
  // step that Undo can take back.
  useEffect(() => {
    if (!editor || markdown === lastEmitted.current) return
    lastEmitted.current = markdown
    editor.chain().setContent(markdown, { contentType: 'markdown', emitUpdate: false }).run()
  }, [editor, markdown])

  useEffect(() => editor?.setEditable(!readOnly), [editor, readOnly])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        link: e.isActive('link'),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        task: e.isActive('taskList'),
        table: e.isActive('table'),
        undo: e.can().undo(),
        redo: e.can().redo(),
        blanks: fillIns(e.state.doc),
      },
  })

  if (!editor || !st) return null

  const pickShot = async () => {
    const n = await pick()
    if (n) editor.chain().focus().insertContent({ type: 'screenshot', attrs: { n } }).run()
  }
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link address', prev ?? 'https://')
    if (url === null) return
    if (!url || url === 'https://') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  const blockType = st.h1 ? 'h1' : st.h2 ? 'h2' : st.h3 ? 'h3' : 'p'
  const nextBlank = () => {
    const { from } = editor.state.selection
    const r = st.blanks.find((b) => b.from > from) ?? st.blanks[0]
    if (r) editor.chain().focus().setTextSelection(r).scrollIntoView().run()
  }

  return (
    <DocCtx.Provider value={{ shots, titles, onAnnotate, pick }}>
      {!readOnly && (
        <div className="sticky top-[118px] z-10 mb-4 flex flex-wrap items-center gap-0.5 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-soft backdrop-blur" role="toolbar" aria-label="Formatting">
          <Btn label="Undo" disabled={!st.undo} onClick={() => editor.chain().focus().undo().run()}>
            <Icon name="undo" />
          </Btn>
          <Btn label="Redo" disabled={!st.redo} onClick={() => editor.chain().focus().redo().run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
            </svg>
          </Btn>
          <Sep />
          <select
            className="h-8 rounded-lg bg-transparent px-2 text-sm hover:bg-raised"
            value={blockType}
            aria-label="Text style"
            onChange={(e) => {
              const v = e.target.value
              const c = editor.chain().focus()
              if (v === 'p') c.setParagraph().run()
              else c.setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
            }}
          >
            <option value="p">Text</option>
            <option value="h1">Title</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
          </select>
          <Sep />
          <Btn label="Bold" on={st.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <b>B</b>
          </Btn>
          <Btn label="Italic" on={st.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <i className="font-serif">I</i>
          </Btn>
          <Btn label="Link" on={st.link} onClick={setLink}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
          </Btn>
          <Sep />
          <Btn label="Bulleted list" on={st.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <Icon name="list" />
          </Btn>
          <Btn label="Numbered list" on={st.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <span className="text-xs font-semibold">1.</span>
          </Btn>
          <Btn label="Checklist" on={st.task} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <Icon name="check" />
          </Btn>
          <Sep />
          <div className="relative">
            <button type="button" className="btn-secondary h-8 rounded-lg px-2.5 py-0" onMouseDown={(e) => e.preventDefault()} onClick={() => setInsertOpen((o) => !o)} aria-expanded={insertOpen}>
              <Icon name="plus" /> Insert
            </button>
            {insertOpen && (
              <div className="absolute left-0 top-full z-30 mt-1">
                <InsertMenu editor={editor} pickShot={pickShot} onDone={() => setInsertOpen(false)} />
              </div>
            )}
          </div>
          {st.table && (
            <>
              <Sep />
              <span className="px-1 text-xs text-muted">Table:</span>
              <Btn label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <span className="text-xs">+ Row</span>
              </Btn>
              <Btn label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <span className="text-xs">+ Column</span>
              </Btn>
              <Btn label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
                <span className="text-xs">− Row</span>
              </Btn>
              <Btn label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <span className="text-xs">− Column</span>
              </Btn>
              <Btn label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
                <Icon name="trash" />
              </Btn>
            </>
          )}
          <span className="ml-auto flex items-center gap-3 px-2 text-xs text-muted">
            {st.blanks.length > 0 && (
              <button type="button" className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-200" onClick={nextBlank}>
                {st.blanks.length} to fill in →
              </button>
            )}
            <span aria-live="polite">{saved === 'saving' ? 'Saving…' : 'Saved'}</span>
          </span>
        </div>
      )}

      <div className="doc-page rounded-[20px] border border-line bg-surface px-6 py-10 shadow-soft sm:px-14">
        {!readOnly && (
          <>
            <BubbleMenu editor={editor} shouldShow={({ editor: e, state }) => !state.selection.empty && e.isEditable && !e.isActive('screenshot')}>
              <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-float">
                <Btn label="Bold" on={st.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <b>B</b>
                </Btn>
                <Btn label="Italic" on={st.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <i className="font-serif">I</i>
                </Btn>
                <Btn label="Link" on={st.link} onClick={setLink}>
                  <span className="text-xs font-medium">Link</span>
                </Btn>
                <Btn label="Heading" on={st.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <span className="text-xs font-semibold">H</span>
                </Btn>
                <Btn label="Bulleted list" on={st.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  <Icon name="list" />
                </Btn>
              </div>
            </BubbleMenu>
            <FloatingMenu editor={editor} shouldShow={({ state }) => state.selection.empty && state.selection.$from.parent.type.name === 'paragraph' && state.selection.$from.parent.content.size === 0 && state.selection.$from.depth === 1}>
              {slash ? (
                <InsertMenu editor={editor} pickShot={pickShot} onDone={() => setSlash(false)} />
              ) : (
                <button type="button" className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-muted hover:bg-raised hover:text-ink" onMouseDown={(e) => e.preventDefault()} onClick={() => setSlash(true)}>
                  <Icon name="plus" className="h-3.5 w-3.5" /> Insert, or type /
                </button>
              )}
            </FloatingMenu>
            <DragHandle editor={editor} onNodeChange={({ node, pos }) => (hovered.current = node ? { from: pos, to: pos + node.nodeSize } : null)}>
              <BlockGrip editor={editor} block={() => hovered.current} />
            </DragHandle>
          </>
        )}
        <EditorContent editor={editor} />
      </div>
      {picker && (
        <Picker
          shots={shots}
          titles={titles}
          current={picker.current}
          onPick={(n) => {
            picker.resolve(n)
            setPicker(null)
          }}
        />
      )}
    </DocCtx.Provider>
  )
}

// The handle beside each block: drag to move, click for Duplicate / Delete.
function BlockGrip({ editor, block: hoveredBlock }: { editor: Editor; block: () => { from: number; to: number } | null }) {
  const [open, setOpen] = useState(false)
  const block = () => {
    const h = hoveredBlock()
    if (h) return h
    const { $from } = editor.state.selection
    const depth = Math.max(1, $from.depth)
    return { from: $from.before(depth), to: $from.after(depth) }
  }
  return (
    <div className="relative">
      <button type="button" className="grid h-6 w-5 cursor-grab place-items-center rounded text-muted/70 hover:bg-raised hover:text-ink" title="Drag to move, click for options" aria-label="Block options" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor" aria-hidden>
          {[2, 8, 14].map((y) => [2, 8].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-36 rounded-xl border border-line bg-surface p-1 shadow-float" onMouseLeave={() => setOpen(false)}>
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false)
              const { from, to } = block()
              const slice = editor.state.doc.slice(from, to)
              editor.chain().focus().insertContentAt(to, slice.toJSON()?.content ?? []).run()
            }}
          >
            Duplicate
          </button>
          <button
            className="menu-item text-rec"
            onClick={() => {
              setOpen(false)
              editor.chain().focus().deleteRange(block()).run()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
