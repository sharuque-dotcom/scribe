import JSZip from 'jszip'
import { Packer } from 'docx'
import { describe, expect, it } from 'vitest'
import { guideDocx, markdownDocx } from './docx'
import type { Guide } from './types'

// 1x1 PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const sizeOf = async () => ({ w: 1280, h: 800 })

async function documentXml(doc: Awaited<ReturnType<typeof guideDocx>>) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc))
  return { xml: await zip.file('word/document.xml')!.async('string'), media: Object.keys(zip.files).filter((f) => f.startsWith('word/media/')) }
}

describe('guideDocx', () => {
  it('writes the title, numbered steps, notes and screenshots', async () => {
    const guide: Guide = {
      id: 'g', title: 'Add a contact', description: 'How to add one.', createdAt: 0, updatedAt: 0, status: 'ready', docs: {},
      steps: [
        { id: 'a', kind: 'step', title: 'Click "New contact"', annotations: [], createdAt: 0, imageId: 'i' },
        { id: 'n', kind: 'note', noteStyle: 'tip', title: 'Search first.', annotations: [], createdAt: 0 },
        { id: 'b', kind: 'step', title: 'Click "Save"', annotations: [], createdAt: 0 },
      ],
    }
    const { xml, media } = await documentXml(await guideDocx(guide, { a: PNG }, sizeOf))
    expect(xml).toContain('Add a contact')
    expect(xml).toContain('Click &quot;New contact&quot;')
    expect(xml).toContain('Tip: ')
    expect(xml).toContain('2. ')
    expect(media).toHaveLength(1)
  })
})

describe('markdownDocx', () => {
  it('handles headings, lists, tables, quotes and screenshot placeholders', async () => {
    const md = `# My SOP

| Item | Details |
|---|---|
| **Version** | 1.0 |

## 4. Procedure

**Step 1.** Click **Save**

{{screenshot:1}}

> **Tip:** Check first.

- [ ] Click Save
1. First
2. Second

<details><summary>Answer key</summary>

1. B

</details>
`
    const { xml, media } = await documentXml(await markdownDocx('My SOP', md, { 1: PNG }, sizeOf))
    for (const text of ['My SOP', 'Version', '4. Procedure', 'Step 1.', 'Tip:', '☐ ', '2. ', 'Second', 'Answer key']) expect(xml).toContain(text)
    expect(xml).toContain('<w:tbl>')
    expect(media).toHaveLength(1)
  })
})
