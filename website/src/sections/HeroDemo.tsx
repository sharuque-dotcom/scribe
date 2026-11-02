import { gsap } from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { typeInto, useLoop } from '../motion'

// The page inside the mock browser is designed at this size, then scaled to fit.
const PW = 640
const PH = 400

// Where things are on the mock page (page pixels).
const NAME = { x: 196, y: 128, w: 300, h: 34 }
const EMAIL = { x: 196, y: 196, w: 300, h: 34 }
const STAGE = { x: 196, y: 264, w: 300, h: 34 }
const SAVE = { x: 196, y: 326, w: 128, h: 36 }
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

const STEPS = [
  'Type “Jordan Lee” into the Full name field',
  'Type “jordan@northwind.io” into Email',
  'Select “Customer” from Lifecycle stage',
  'Click the Save contact button',
]

export function HeroDemo() {
  const stage = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(() => setFit(el.clientWidth / PW))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const root = useLoop((r) => {
    const q = gsap.utils.selector(r)
    const cam = q('.cam')[0] as HTMLElement
    const camState = { z: 1, x: PW / 2, y: PH / 2 }
    // Camera: zoom z around a page point, kept inside the page.
    const applyCam = () => {
      const { z, x, y } = camState
      const tx = Math.min(0, Math.max(PW - PW * z, PW / 2 - x * z))
      const ty = Math.min(0, Math.max(PH - PH * z, PH / 2 - y * z))
      cam.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
    }
    const look = (tl: gsap.core.Timeline, p: { x: number; y: number }, z: number, at: gsap.Position, d = 1) =>
      tl.to(camState, { z, x: p.x, y: p.y, duration: d, ease: 'power3.inOut', onUpdate: applyCam }, at)
    const cursorTo = (tl: gsap.core.Timeline, p: { x: number; y: number }, at: gsap.Position, d = 0.9) =>
      tl.to('.cursor', { x: p.x, y: p.y, duration: d, ease: 'power2.inOut' }, at)
    const click = (tl: gsap.core.Timeline, p: { x: number; y: number }, at: gsap.Position) => {
      tl.set('.ripple', { x: p.x, y: p.y, scale: 0.2, autoAlpha: 0.9 }, at)
      tl.to('.ripple', { scale: 1.6, autoAlpha: 0, duration: 0.55, ease: 'power2.out' }, '<')
      tl.to('.cursor', { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, '<')
    }
    const caption = (tl: gsap.core.Timeline, text: string, at: gsap.Position) => {
      tl.to('.caption', { autoAlpha: 0, y: 6, duration: 0.15 }, at)
      tl.call(() => {
        q('.caption-text')[0].textContent = text
      }, [], '>')
      tl.to('.caption', { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, '>')
      tl.fromTo('.wave i', { scaleY: 0.2 }, { scaleY: () => 0.4 + Math.random() * 0.6, duration: 0.18, repeat: 9, yoyo: true, ease: 'sine.inOut', stagger: 0.03 }, '<')
    }
    const addStep = (tl: gsap.core.Timeline, i: number, at: gsap.Position) =>
      tl.fromTo(q('.step')[i], { autoAlpha: 0, x: 24, scale: 0.96 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, at)

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, defaults: { ease: 'power2.inOut' } })
    // Reset.
    tl.call(() => {
      Object.assign(camState, { z: 1, x: PW / 2, y: PH / 2 })
      applyCam()
      for (const el of q('.typed')) el.textContent = ''
    })
    tl.set('.cursor', { x: 560, y: 360, scale: 1 })
    tl.set(['.step', '.chip', '.toast', '.caption'], { autoAlpha: 0 })
    tl.set('.select-value', { autoAlpha: 0 })
    tl.set('.field', { borderColor: '#e5e7eb', boxShadow: 'none' })
    tl.to({}, { duration: 0.6 })

    // 1. Full name
    cursorTo(tl, centre(NAME), '>')
    look(tl, centre(NAME), 1.75, '<0.2')
    click(tl, centre(NAME), '>-0.1')
    tl.to('.f-name', { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,.25)', duration: 0.2 }, '<')
    caption(tl, STEPS[0], '<')
    addStep(tl, 0, '<0.1')
    typeInto(tl, q('.t-name')[0], 'Jordan Lee', 0.7, '<0.1')
    tl.to('.f-name', { borderColor: '#e5e7eb', boxShadow: 'none', duration: 0.2 }, '>0.5')

    // 2. Email (camera pans down)
    cursorTo(tl, centre(EMAIL), '<')
    look(tl, centre(EMAIL), 1.75, '<', 0.8)
    click(tl, centre(EMAIL), '>-0.1')
    tl.to('.f-email', { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,.25)', duration: 0.2 }, '<')
    caption(tl, STEPS[1], '<')
    addStep(tl, 1, '<0.1')
    typeInto(tl, q('.t-email')[0], 'jordan@northwind.io', 1, '<0.1')
    tl.to('.f-email', { borderColor: '#e5e7eb', boxShadow: 'none', duration: 0.2 }, '>0.4')

    // 3. Lifecycle stage
    cursorTo(tl, centre(STAGE), '<')
    look(tl, centre(STAGE), 1.75, '<', 0.8)
    click(tl, centre(STAGE), '>-0.1')
    tl.to('.select-value', { autoAlpha: 1, duration: 0.25 }, '>0.15')
    tl.to('.select-placeholder', { autoAlpha: 0, duration: 0.2 }, '<')
    caption(tl, STEPS[2], '<')
    addStep(tl, 2, '<0.1')

    // 4. Save
    cursorTo(tl, centre(SAVE), '>0.5')
    look(tl, centre(SAVE), 1.6, '<', 0.8)
    click(tl, centre(SAVE), '>-0.05')
    tl.to('.save', { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1 }, '<')
    caption(tl, STEPS[3], '<')
    addStep(tl, 3, '<0.1')
    tl.fromTo('.toast', { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, '>0.2')

    // Zoom out, outputs pop in.
    look(tl, { x: PW / 2, y: PH / 2 }, 1, '>0.5', 1.1)
    tl.to('.caption', { autoAlpha: 0, duration: 0.3 }, '<')
    tl.fromTo('.chip', { autoAlpha: 0, y: 14, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.12, ease: 'back.out(2)' }, '>-0.2')
    tl.to({}, { duration: 2.2 })
    tl.to(['.chip', '.step', '.toast'], { autoAlpha: 0, duration: 0.4 })
    // Editor timeline playhead follows the demo.
    const head = q('.playhead')[0] as HTMLElement
    const time = q('.tl-time')[0] as HTMLElement
    tl.eventCallback('onUpdate', () => {
      head.style.left = `${tl.progress() * 100}%`
      const t = tl.time()
      time.textContent = `0:${String(Math.floor(t)).padStart(2, '0')}`
    })
    return tl
  }, 0.86)

  const field = 'field absolute flex items-center rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900'

  return (
    <div ref={root} className="relative rounded-[36px] bg-white p-2 shadow-float ring-1 ring-line sm:p-3">
      {/* Art card with the mock browser */}
      <div className="art art-sky aspect-[3/5] w-full rounded-[28px] sm:aspect-[16/9]">
        <div className="absolute left-[5%] right-[5%] top-[6%] overflow-hidden rounded-2xl bg-white shadow-float sm:left-[4%] sm:right-[31%] sm:top-[7%]">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 truncate rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">app.acme-crm.example/contacts/new</span>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> REC
            </span>
          </div>
          <div ref={stage} className="relative overflow-hidden" style={{ height: PH * fit }}>
            <div style={{ width: PW, height: PH, transform: `scale(${fit})`, transformOrigin: '0 0' }}>
              <div className="cam relative" style={{ width: PW, height: PH, transformOrigin: '0 0' }}>
                {/* Mock CRM page */}
                <div className="absolute inset-y-0 left-0 w-[150px] bg-[#1e1b4b] px-4 py-5 text-[12px] text-white/70">
                  <p className="mb-5 text-[15px] font-bold text-white">Acme CRM</p>
                  {['Dashboard', 'Contacts', 'Companies', 'Deals', 'Reports'].map((n) => (
                    <p key={n} className={`mb-1 rounded-md px-2 py-1.5 ${n === 'Contacts' ? 'bg-white/15 text-white' : ''}`}>
                      {n}
                    </p>
                  ))}
                </div>
                <p className="absolute left-[196px] top-[52px] text-[22px] font-bold text-gray-900">New contact</p>
                {[
                  ['Full name', NAME, 'f-name', 't-name'],
                  ['Email', EMAIL, 'f-email', 't-email'],
                ].map(([label, r, f, t]) => {
                  const rr = r as typeof NAME
                  return (
                    <div key={label as string}>
                      <p className="absolute text-[12px] font-semibold text-gray-700" style={{ left: rr.x, top: rr.y - 20 }}>
                        {label as string}
                      </p>
                      <div className={`${field} ${f}`} style={{ left: rr.x, top: rr.y, width: rr.w, height: rr.h }}>
                        <span className={`typed ${t}`} />
                      </div>
                    </div>
                  )
                })}
                <p className="absolute text-[12px] font-semibold text-gray-700" style={{ left: STAGE.x, top: STAGE.y - 20 }}>
                  Lifecycle stage
                </p>
                <div className={field} style={{ left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h }}>
                  <span className="select-placeholder text-gray-400">Choose a stage</span>
                  <span className="select-value absolute left-3">Customer</span>
                  <span className="ml-auto text-gray-400">▾</span>
                </div>
                <div className="save absolute flex items-center justify-center rounded-lg bg-[#4f46e5] text-[13px] font-semibold text-white" style={{ left: SAVE.x, top: SAVE.y, width: SAVE.w, height: SAVE.h }}>
                  Save contact
                </div>
                <div className="toast absolute right-6 top-5 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 shadow-sm">✓ Contact saved</div>
                {/* Click ripple and smooth cursor */}
                <span className="ripple pointer-events-none absolute -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-indigo-500 bg-indigo-400/20" />
                <svg className="cursor pointer-events-none absolute left-0 top-0 h-[26px] w-[20px] drop-shadow" viewBox="0 0 18 27" style={{ transformOrigin: '0 0' }}>
                  <path d="M0 0v23l6-5.5 4.5 9.5 4-1.8-4.3-9.2H18z" fill="#111827" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            {/* Caption + voice (not zoomed) */}
            <div className="caption pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="flex max-w-[92%] items-center gap-2 rounded-xl bg-gray-900/90 px-3 py-2 text-[11px] font-semibold text-white shadow-lg sm:text-[13px]">
                <span className="wave flex h-4 items-center gap-[2px]" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className="block h-full w-[3px] origin-center rounded-full bg-emerald-400" />
                  ))}
                </span>
                <span className="caption-text truncate" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating guide panel */}
        <div className="absolute bottom-[4%] left-[5%] right-[5%] rounded-2xl bg-white/90 p-3 text-left shadow-float backdrop-blur sm:bottom-auto sm:left-auto sm:right-[4%] sm:top-[12%] sm:w-[27%]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-gray-900">Add a new contact</p>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Guide</span>
          </div>
          <div className="space-y-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="step flex items-center gap-2 rounded-lg bg-gray-50 p-1.5">
                <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-orange-500 text-[10px] font-bold text-white">{i + 1}</span>
                <span className="truncate text-[11px] text-gray-700">{s}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['✓ SOP', '✓ Training', '✓ Video · 1080p', '✓ Voiceover'].map((c) => (
              <span key={c} className="chip rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Editor-style timeline under the showcase */}
      <div className="mt-2 hidden rounded-[22px] bg-[#f4f2ee] px-4 py-3 sm:block">
        <div className="mb-2 flex items-center gap-3 text-[11px] font-medium text-soft">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[9px] text-white" aria-hidden>
            ▶
          </span>
          <span className="tl-time tabular-nums">0:00</span>
          <span className="ml-auto">Auto-zoom · Captions · Voice</span>
        </div>
        <div className="relative h-[62px]">
          {[6, 30, 52, 74].map((l, i) => (
            <span key={l} className="absolute top-0 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-orange-500 text-[8px] font-bold text-white" style={{ left: `${l}%` }}>
              {i + 1}
            </span>
          ))}
          <div className="absolute inset-x-0 top-[22px] h-[16px] rounded-md bg-amber-400/90 text-center text-[9px] font-semibold leading-[16px] text-amber-950">Clip · tab recording</div>
          <div className="absolute left-[3%] top-[42px] h-[16px] w-[86%] rounded-md bg-indigo-500 text-center text-[9px] font-semibold leading-[16px] text-white">Zoom · 1.8× · auto</div>
          <span className="playhead absolute -top-1 bottom-0 w-[2px] rounded bg-red-500" style={{ left: 0 }} />
        </div>
      </div>
    </div>
  )
}
