// Word (.docx) export for guides and SOP / training documents, as normal
// editable Word content: headings, numbered steps, tables and screenshots.
import {
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'
import { marked, type Token, type Tokens } from 'marked'
import { stepNumbers } from './templates'
import type { Guide } from './types'

export type SizeOf = (dataUrl: string) => Promise<{ w: number; h: number }>

// Width of the page's text area at 96 dpi (A4/Letter with 1" margins is ~6.3").
const MAX_W = 600

export const browserSizeOf: SizeOf = async (dataUrl) => {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob())
  const size = { w: bmp.width, h: bmp.height }
  bmp.close()
  return size
}

async function image(dataUrl: string, sizeOf: SizeOf): Promise<Paragraph> {
  const { w, h } = await sizeOf(dataUrl)
  const width = Math.min(MAX_W, w)
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    children: [
      new ImageRun({
        type: dataUrl.startsWith('data:image/png') ? 'png' : 'jpg',
        data: dataUrl,
        transformation: { width, height: Math.round((width * h) / w) },
      }),
    ],
  })
}

const pack = (title: string, children: (Paragraph | Table)[]) =>
  new Document({
    title,
    creator: 'StepCrumb',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  })

export async function toBlob(doc: Document): Promise<Blob> {
  return Packer.toBlob(doc)
}

// ---------- guide ----------

export async function guideDocx(guide: Guide, rendered: Record<string, string>, sizeOf: SizeOf = browserSizeOf): Promise<Document> {
  const nums = stepNumbers(guide)
  const out: (Paragraph | Table)[] = [new Paragraph({ text: guide.title, heading: HeadingLevel.TITLE })]
  if (guide.description) out.push(new Paragraph({ text: guide.description, spacing: { after: 240 } }))
  for (const s of guide.steps) {
    if (s.kind === 'heading') out.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }))
    else if (s.kind === 'note') {
      const label = s.noteStyle === 'warning' ? 'Warning: ' : s.noteStyle === 'tip' ? 'Tip: ' : 'Note: '
      out.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: s.noteStyle === 'warning' ? 'FFF7E6' : s.noteStyle === 'tip' ? 'ECFDF3' : 'EFF6FF', color: 'auto' },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: s.noteStyle === 'warning' ? 'F59E0B' : s.noteStyle === 'tip' ? '22C55E' : '3B82F6', space: 6 } },
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: label, bold: true }), new TextRun(s.title + (s.detail ? ` ${s.detail}` : ''))],
        }),
      )
    } else {
      out.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          keepNext: true,
          children: [new TextRun({ text: `${nums.get(s.id)}. `, bold: true, color: 'EA580C' }), new TextRun({ text: s.title, bold: true })],
        }),
      )
      if (s.detail) out.push(new Paragraph({ text: s.detail, keepNext: !!rendered[s.id] }))
      if (rendered[s.id]) out.push(await image(rendered[s.id], sizeOf))
    }
  }
  return pack(guide.title, out)
}

// ---------- SOP / training markdown ----------

const SHOT = /^\{\{\s*screenshot\s*:\s*(\d+)\s*\}\}$/i

function inline(tokens: Token[] | undefined, style: { bold?: boolean; italics?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        out.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }))
        break
      case 'em':
        out.push(...inline((t as Tokens.Em).tokens, { ...style, italics: true }))
        break
      case 'codespan':
        out.push(new TextRun({ text: (t as Tokens.Codespan).text, font: 'Consolas', ...style }))
        break
      case 'link':
        out.push(...inline((t as Tokens.Link).tokens, style))
        break
      case 'br':
        out.push(new TextRun({ text: '', break: 1 }))
        break
      case 'html':
        // Inline HTML such as <summary>: keep its text only.
        out.push(new TextRun({ text: (t as Tokens.HTML).text.replace(/<[^>]+>/g, ''), ...style }))
        break
      default: {
        const tt = t as Tokens.Text
        if (tt.tokens?.length) out.push(...inline(tt.tokens, style))
        else out.push(new TextRun({ text: decode(tt.text ?? tt.raw ?? ''), ...style }))
      }
    }
  }
  return out
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

const HEADINGS = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4]

export async function markdownDocx(title: string, markdown: string, shots: Record<number, string>, sizeOf: SizeOf = browserSizeOf): Promise<Document> {
  const out: (Paragraph | Table)[] = []
  const walk = async (tokens: Token[], indent = 0) => {
    for (const t of tokens) {
      switch (t.type) {
        case 'heading': {
          const h = t as Tokens.Heading
          out.push(new Paragraph({ heading: HEADINGS[Math.min(h.depth, 4)], children: inline(h.tokens) }))
          break
        }
        case 'paragraph': {
          const p = t as Tokens.Paragraph
          // Each line may be a screenshot placeholder.
          const lines = p.text.split('\n')
          if (lines.some((l) => SHOT.test(l.trim()))) {
            for (const l of lines) {
              const m = l.trim().match(SHOT)
              if (m) {
                if (shots[Number(m[1])]) out.push(await image(shots[Number(m[1])], sizeOf))
              } else if (l.trim()) out.push(new Paragraph({ children: inline(marked.Lexer.lexInline(l)), indent: { left: indent * 360 } }))
            }
          } else out.push(new Paragraph({ children: inline(p.tokens), spacing: { after: 120 }, indent: { left: indent * 360 } }))
          break
        }
        case 'list': {
          const l = t as Tokens.List
          let n = typeof l.start === 'number' ? l.start : 1
          for (const item of l.items) {
            const prefix = item.task ? (item.checked ? '☑ ' : '☐ ') : l.ordered ? `${n++}. ` : '• '
            const [first, ...rest] = item.tokens
            const firstInline = first && 'tokens' in first ? (first as Tokens.Text).tokens : undefined
            out.push(
              new Paragraph({
                indent: { left: (indent + 1) * 360, hanging: 260 },
                spacing: { after: 60 },
                children: [new TextRun(prefix), ...inline(firstInline ?? (first ? [first] : []))],
              }),
            )
            await walk(rest.filter((r) => r.type !== 'checkbox'), indent + 1)
          }
          break
        }
        case 'blockquote': {
          const q = t as Tokens.Blockquote
          for (const inner of q.tokens) {
            out.push(
              new Paragraph({
                shading: { type: ShadingType.CLEAR, fill: 'EFF6FF', color: 'auto' },
                border: { left: { style: BorderStyle.SINGLE, size: 18, color: '3B82F6', space: 6 } },
                spacing: { before: 120, after: 120 },
                children: inline('tokens' in inner ? (inner as Tokens.Paragraph).tokens : [inner]),
              }),
            )
          }
          break
        }
        case 'table': {
          const tb = t as Tokens.Table
          const cell = (c: Tokens.TableCell, header: boolean) =>
            new TableCell({
              shading: header ? { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' } : undefined,
              children: [new Paragraph({ children: inline(c.tokens, header ? { bold: true } : {}) })],
            })
          out.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [new TableRow({ tableHeader: true, children: tb.header.map((c) => cell(c, true)) }), ...tb.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) }))],
            }),
          )
          out.push(new Paragraph({ text: '' }))
          break
        }
        case 'html': {
          // e.g. <details><summary>Answer key</summary>: keep the words.
          const text = (t as Tokens.HTML).text.replace(/<summary>(.*?)<\/summary>/gi, '$1\n').replace(/<[^>]+>/g, '').trim()
          for (const line of text.split('\n').filter((x) => x.trim())) out.push(new Paragraph({ children: [new TextRun({ text: line.trim(), bold: true })] }))
          break
        }
        case 'code':
          out.push(new Paragraph({ children: [new TextRun({ text: (t as Tokens.Code).text, font: 'Consolas' })] }))
          break
        case 'hr':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } } }))
          break
        case 'space':
          break
        default:
          if ('text' in t && typeof t.text === 'string' && t.text.trim()) out.push(new Paragraph({ text: decode(t.text) }))
      }
    }
  }
  await walk(marked.lexer(markdown))
  if (!out.length) out.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }))
  return pack(title, out)
}
