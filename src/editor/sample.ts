// A sample guide with drawn screenshots of a made-up CRM, so the editor can be
// tried without capturing anything first.
import { putGuide, putImage } from '../shared/db'
import type { Guide, NRect, Step } from '../shared/types'
import { uid } from '../shared/types'

const W = 1280
const H = 760
const FONT = 'Inter, -apple-system, Segoe UI, Roboto, sans-serif'

interface FormState {
  name?: string
  email?: string
  stage?: string
  saved?: boolean
}

// Layout of the clickable elements, in pixels.
const EL = {
  newBtn: { x: 1080, y: 92, w: 150, h: 40 },
  name: { x: 300, y: 240, w: 420, h: 42 },
  email: { x: 300, y: 330, w: 420, h: 42 },
  stage: { x: 300, y: 420, w: 420, h: 42 },
  save: { x: 300, y: 500, w: 150, h: 42 },
}

const norm = (r: { x: number; y: number; w: number; h: number }): NRect => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H })

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function draw(screen: 'list' | 'form', form: FormState = {}): string {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  // Sidebar
  ctx.fillStyle = '#1e1b4b'
  ctx.fillRect(0, 0, 220, H)
  ctx.fillStyle = '#fff'
  ctx.font = `700 20px ${FONT}`
  ctx.fillText('Acme CRM', 28, 46)
  const nav = ['Dashboard', 'Contacts', 'Companies', 'Deals', 'Reports', 'Settings']
  nav.forEach((n, i) => {
    if (n === 'Contacts') {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      rr(ctx, 14, 88 + i * 44, 192, 36, 8)
      ctx.fill()
    }
    ctx.fillStyle = n === 'Contacts' ? '#fff' : 'rgba(255,255,255,0.65)'
    ctx.font = `500 15px ${FONT}`
    ctx.fillText(n, 30, 111 + i * 44)
  })

  // Top bar
  ctx.fillStyle = '#fff'
  ctx.fillRect(220, 0, W - 220, 64)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(220, 64, W - 220, 1)
  ctx.fillStyle = '#f1f5f9'
  rr(ctx, 250, 16, 360, 34, 8)
  ctx.fill()
  ctx.fillStyle = '#94a3b8'
  ctx.font = `14px ${FONT}`
  ctx.fillText('Search contacts, companies…', 268, 38)
  ctx.fillStyle = '#c7d2fe'
  ctx.beginPath()
  ctx.arc(W - 40, 32, 16, 0, Math.PI * 2)
  ctx.fill()

  if (screen === 'list') {
    ctx.fillStyle = '#0f172a'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText('Contacts', 260, 122)
    const b = EL.newBtn
    ctx.fillStyle = '#4f46e5'
    rr(ctx, b.x, b.y, b.w, b.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `600 15px ${FONT}`
    ctx.fillText('+ New contact', b.x + 22, b.y + 26)
    // Table
    ctx.fillStyle = '#fff'
    rr(ctx, 260, 160, W - 300, 520, 12)
    ctx.fill()
    ctx.strokeStyle = '#e2e8f0'
    ctx.stroke()
    const rows = [
      ['Name', 'Email', 'Stage', 'Owner'],
      ['Ava Patel', 'ava@contoso.com', 'Customer', 'Sam'],
      ['Marcus Chen', 'marcus@fabrikam.io', 'Lead', 'Priya'],
      ['Sofia Garcia', 'sofia@tailspin.co', 'Opportunity', 'Sam'],
      ['Liam O’Brien', 'liam@wingtip.com', 'Lead', 'Dana'],
      ['Noah Kim', 'noah@litware.net', 'Customer', 'Priya'],
    ]
    rows.forEach((r, i) => {
      const y = 200 + i * 52
      ctx.fillStyle = i === 0 ? '#64748b' : '#0f172a'
      ctx.font = `${i === 0 ? 600 : 400} 14px ${FONT}`
      ;[0, 260, 560, 760].forEach((dx, j) => ctx.fillText(r[j], 290 + dx, y))
      if (i > 0) {
        ctx.fillStyle = '#f1f5f9'
        ctx.fillRect(280, y + 20, W - 340, 1)
      }
    })
  } else {
    ctx.fillStyle = '#0f172a'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText(form.saved ? 'Jordan Lee' : 'New contact', 260, 122)
    if (form.saved) {
      ctx.fillStyle = '#dcfce7'
      rr(ctx, 260, 150, 520, 48, 8)
      ctx.fill()
      ctx.fillStyle = '#166534'
      ctx.font = `600 15px ${FONT}`
      ctx.fillText('✓  Contact saved. Jordan Lee was added to Contacts.', 280, 180)
    }
    const field = (label: string, r: typeof EL.name, value?: string, isSelect = false) => {
      ctx.fillStyle = '#334155'
      ctx.font = `600 14px ${FONT}`
      ctx.fillText(label, r.x, r.y - 12)
      ctx.fillStyle = '#fff'
      rr(ctx, r.x, r.y, r.w, r.h, 8)
      ctx.fill()
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = value ? '#0f172a' : '#94a3b8'
      ctx.font = `15px ${FONT}`
      ctx.fillText(value || (isSelect ? 'Choose a stage' : ''), r.x + 14, r.y + 27)
      if (isSelect) {
        ctx.fillStyle = '#64748b'
        ctx.fillText('▾', r.x + r.w - 26, r.y + 27)
      }
    }
    if (!form.saved) {
      field('Full name', EL.name, form.name)
      field('Email', EL.email, form.email)
      field('Lifecycle stage', EL.stage, form.stage, true)
      const s = EL.save
      ctx.fillStyle = '#4f46e5'
      rr(ctx, s.x, s.y, s.w, s.h, 8)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `600 15px ${FONT}`
      ctx.fillText('Save contact', s.x + 28, s.y + 27)
      ctx.fillStyle = '#64748b'
      ctx.font = `500 15px ${FONT}`
      ctx.fillText('Cancel', s.x + 180, s.y + 27)
    } else {
      ctx.fillStyle = '#334155'
      ctx.font = `15px ${FONT}`
      ;['Email: jordan@northwind.io', 'Lifecycle stage: Customer', 'Owner: You'].forEach((t, i) => ctx.fillText(t, 260, 250 + i * 34))
    }
  }
  return c.toDataURL('image/jpeg', 0.9)
}

export async function createSampleGuide(): Promise<Guide> {
  const now = Date.now()
  const base = 'https://app.acme-crm.example/contacts'
  const shots: { title: string; screen: 'list' | 'form'; form?: FormState; rect?: NRect; action: Step['action']; url: string }[] = [
    { title: 'Go to app.acme-crm.example/contacts', screen: 'list', action: 'navigate', url: base },
    { title: 'Click the "+ New contact" button', screen: 'list', rect: norm(EL.newBtn), action: 'click', url: base },
    { title: 'Type "Jordan Lee" into the "Full name" field', screen: 'form', form: { name: 'Jordan Lee' }, rect: norm(EL.name), action: 'type', url: base + '/new' },
    { title: 'Type "jordan@northwind.io" into the "Email" field', screen: 'form', form: { name: 'Jordan Lee', email: 'jordan@northwind.io' }, rect: norm(EL.email), action: 'type', url: base + '/new' },
    { title: 'Select "Customer" from the "Lifecycle stage" dropdown', screen: 'form', form: { name: 'Jordan Lee', email: 'jordan@northwind.io', stage: 'Customer' }, rect: norm(EL.stage), action: 'select', url: base + '/new' },
    { title: 'Click the "Save contact" button', screen: 'form', form: { name: 'Jordan Lee', email: 'jordan@northwind.io', stage: 'Customer' }, rect: norm(EL.save), action: 'click', url: base + '/new' },
  ]
  const steps: Step[] = []
  for (const [i, s] of shots.entries()) {
    const imageId = uid()
    await putImage({ id: imageId, dataUrl: draw(s.screen, s.form), w: W, h: H })
    steps.push({
      id: uid(),
      kind: 'step',
      title: s.title,
      action: s.action,
      url: s.url,
      pageTitle: 'Contacts · Acme CRM',
      imageId,
      targetRect: s.rect,
      // Field labels sit just above each field.
      labelRect: s.action === 'type' || s.action === 'select' ? { x: s.rect!.x, y: s.rect!.y - 30 / H, w: 160 / W, h: 22 / H } : undefined,
      click: s.rect ? { x: s.rect.x + s.rect.w / 2, y: s.rect.y + s.rect.h / 2 } : undefined,
      showAutoHighlight: !!s.rect,
      annotations: [],
      createdAt: now + i,
    })
    if (i === 1) steps.push({ id: uid(), kind: 'heading', title: 'Fill in the contact details', annotations: [], createdAt: now + i })
  }
  steps.push({ id: uid(), kind: 'note', noteStyle: 'tip', title: 'Search Contacts first so you don’t create a duplicate.', annotations: [], createdAt: now + 10 })
  // Move the tip right after the first step.
  steps.splice(1, 0, steps.pop()!)

  const guide: Guide = {
    id: uid(),
    title: 'Add a new contact in Acme CRM',
    description: 'How to create a contact record and set its lifecycle stage.',
    createdAt: now,
    updatedAt: now,
    status: 'ready',
    steps,
    docs: {},
  }
  await putGuide(guide)
  return guide
}
