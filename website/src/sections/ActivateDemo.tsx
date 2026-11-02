import { gsap } from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { typeInto, useLoop } from '../motion'

// Animated "how to activate Pro": copy the key from Polar's email, click the
// StepCrumb icon, choose Enter license key, paste, Activate. Same style as the hero.

const PW = 640
const PH = 400
const KEY = 'STEPCRUMB-7F3K-9QXA-2M8D'

// Where things are on the mock page (page pixels).
const KEYBOX = { x: 40, y: 172, w: 330, h: 40 }
const ICON = { x: 586, y: 7, w: 22, h: 22 }
const POPUP = { x: 418, y: 38, w: 210, h: 116 }
const ENTER = { x: 438, y: 118, w: 170, h: 26 }
const INPUT = { x: 156, y: 196, w: 236, h: 34 }
const ACTIVATE = { x: 400, y: 196, w: 84, h: 34 }
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

const ACTIVATE_STEPS = ['Copy the key from Polar’s email', 'Click the StepCrumb icon', 'Choose Enter license key', 'Paste it and press Activate']

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#151412" />
      <circle cx="18" cy="44" r="6" fill="#F97316" />
      <circle cx="32" cy="32" r="7.5" fill="#FAF8F4" />
      <circle cx="46" cy="18" r="9" fill="#818CF8" />
    </svg>
  )
}

export function ActivateDemo() {
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
    const applyCam = () => {
      const { z, x, y } = camState
      const tx = Math.min(0, Math.max(PW - PW * z, PW / 2 - x * z))
      const ty = Math.min(0, Math.max(PH - PH * z, PH / 2 - y * z))
      cam.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
    }
    const look = (tl: gsap.core.Timeline, p: { x: number; y: number }, z: number, at: gsap.Position, d = 0.9) =>
      tl.to(camState, { z, x: p.x, y: p.y, duration: d, ease: 'power3.inOut', onUpdate: applyCam }, at)
    const cursorTo = (tl: gsap.core.Timeline, p: { x: number; y: number }, at: gsap.Position, d = 0.8) =>
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
    }
    // Highlights step i in the side panel (earlier ones get a tick).
    const step = (tl: gsap.core.Timeline, i: number, at: gsap.Position) => {
      tl.call(() => {
        q('.astep').forEach((el, j) => {
          el.classList.toggle('is-now', j === i)
          el.classList.toggle('is-done', j < i)
        })
      }, [], at)
    }
    const keyChip = (tl: gsap.core.Timeline, text: string, p: { x: number; y: number }, at: gsap.Position) => {
      tl.call(() => {
        q('.kbd')[0].textContent = text
      }, [], at)
      tl.fromTo('.kbd', { x: p.x, y: p.y, autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, '<')
      tl.to('.kbd', { autoAlpha: 0, duration: 0.25 }, '>0.6')
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 })
    // Reset.
    tl.call(() => {
      Object.assign(camState, { z: 1, x: PW / 2, y: PH / 2 })
      applyCam()
      q('.typed')[0].textContent = ''
      q('.astep').forEach((el) => el.classList.remove('is-now', 'is-done'))
    })
    tl.set('.cursor', { x: 520, y: 330, scale: 1 })
    tl.set(['.caption', '.popup', '.license', '.pro', '.kbd', '.select', '.burst i', '.ripple'], { autoAlpha: 0 })
    const label = (text: string, at: gsap.Position) => tl.call(() => void (q('.activate-label')[0].textContent = text), [], at)
    label('Activate', '>')
    tl.set('.email', { autoAlpha: 1 })
    tl.to({}, { duration: 0.5 })

    // 1. Copy the key from the email.
    step(tl, 0, '>')
    caption(tl, ACTIVATE_STEPS[0], '<')
    cursorTo(tl, { x: KEYBOX.x + 20, y: centre(KEYBOX).y }, '<')
    look(tl, centre(KEYBOX), 1.7, '<0.2')
    tl.fromTo('.select', { autoAlpha: 1, scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power1.inOut' }, '>-0.1')
    tl.to('.cursor', { x: KEYBOX.x + KEYBOX.w - 24, duration: 0.6, ease: 'power1.inOut' }, '<')
    keyChip(tl, '⌘C  Copied', { x: KEYBOX.x + KEYBOX.w - 60, y: KEYBOX.y - 34 }, '>0.1')

    // 2. Click the StepCrumb icon in the toolbar.
    step(tl, 1, '>')
    caption(tl, ACTIVATE_STEPS[1], '<')
    look(tl, centre(ICON), 1.9, '<', 1)
    cursorTo(tl, centre(ICON), '<', 1)
    tl.to('.select', { autoAlpha: 0, duration: 0.2 }, '<0.3')
    click(tl, centre(ICON), '>')
    tl.fromTo('.popup', { autoAlpha: 0, y: -8, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, '<0.05')

    // 3. Choose Enter license key.
    step(tl, 2, '>0.2')
    caption(tl, ACTIVATE_STEPS[2], '<')
    look(tl, centre(ENTER), 1.9, '<', 0.7)
    cursorTo(tl, centre(ENTER), '<', 0.7)
    tl.to('.enter', { backgroundColor: '#eef2ff', duration: 0.15 }, '>-0.1')
    click(tl, centre(ENTER), '>0.05')
    tl.to('.popup', { autoAlpha: 0, duration: 0.2 }, '>0.1')
    tl.to('.email', { autoAlpha: 0, duration: 0.3 }, '<')
    tl.fromTo('.license', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, '<0.1')
    tl.set('.enter', { backgroundColor: 'transparent' }, '>')

    // 4. Paste and Activate.
    step(tl, 3, '>0.1')
    caption(tl, ACTIVATE_STEPS[3], '<')
    look(tl, { x: 320, y: centre(INPUT).y }, 1.6, '<', 0.8)
    cursorTo(tl, centre(INPUT), '<', 0.8)
    click(tl, centre(INPUT), '>')
    tl.to('.f-input', { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,.25)', duration: 0.2 }, '<')
    keyChip(tl, '⌘V  Paste', { x: INPUT.x + 60, y: INPUT.y - 34 }, '>0.15')
    typeInto(tl, q('.typed')[0], KEY, 0.25, '<0.1')
    tl.to('.f-input', { borderColor: '#e5e7eb', boxShadow: 'none', duration: 0.2 }, '>0.3')
    cursorTo(tl, centre(ACTIVATE), '<', 0.5)
    click(tl, centre(ACTIVATE), '>')
    tl.to('.activate', { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, '<')
    label('Checking…', '<')
    label('Activate', '>0.6')
    tl.fromTo('.pro', { autoAlpha: 0, y: 10, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' }, '<')
    tl.fromTo(
      '.burst i',
      { x: 0, y: 0, autoAlpha: 1, scale: 1 },
      { x: (i: number) => Math.cos((i / 10) * Math.PI * 2) * 70, y: (i: number) => Math.sin((i / 10) * Math.PI * 2) * 40, autoAlpha: 0, scale: 0.4, duration: 0.9, ease: 'power2.out' },
      '<0.1',
    )
    tl.call(() => q('.astep').forEach((el) => (el.classList.remove('is-now'), el.classList.add('is-done'))), [], '<')
    caption(tl, 'StepCrumb Pro is on ✓', '<')
    look(tl, { x: PW / 2, y: PH / 2 }, 1, '>0.3', 1)
    tl.to({}, { duration: 2.2 })
    tl.to(['.caption', '.license', '.pro'], { autoAlpha: 0, duration: 0.4 })
    return tl
  }, 0.97)

  const box = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x, top: r.y, width: r.w, height: r.h })

  return (
    <div ref={root} className="relative rounded-[36px] bg-white p-2 shadow-float ring-1 ring-line sm:p-3">
      <style>{`
        .astep{transition:background-color .3s,box-shadow .3s}
        .astep.is-now{background:#eef2ff;box-shadow:0 0 0 2px #6366f1 inset}
        .astep.is-now .num{background:#6366f1}
        .astep.is-done .num{background:#10b981}
      `}</style>
      <div className="art art-violet aspect-[4/5] w-full rounded-[28px] sm:aspect-[16/9]">
        {/* Mock browser */}
        <div className="absolute left-[5%] right-[5%] top-[5%] overflow-hidden rounded-2xl bg-white shadow-float sm:left-[4%] sm:right-[31%] sm:top-[8%]">
          <div ref={stage} className="relative overflow-hidden" style={{ height: PH * fit }}>
            <div style={{ width: PW, height: PH, transform: `scale(${fit})`, transformOrigin: '0 0' }}>
              <div className="cam relative bg-white" style={{ width: PW, height: PH, transformOrigin: '0 0' }}>
                {/* Toolbar */}
                <div className="absolute inset-x-0 top-0 flex h-[36px] items-center gap-2 border-b border-gray-100 bg-gray-50 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-2 w-[340px] truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-gray-500 ring-1 ring-gray-200">mail.example.com/inbox/your-stepcrumb-license</span>
                </div>
                <div className="absolute" style={box(ICON)}>
                  <Mark className="h-full w-full" />
                </div>

                {/* Polar's email */}
                <div className="email absolute inset-x-0 bottom-0 top-[36px] px-10 py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">From Polar · StepCrumb</p>
                  <p className="mt-2 text-[22px] font-bold text-gray-900">Your StepCrumb Pro license</p>
                  <p className="mt-2 text-[13px] text-gray-600">Thanks for your purchase! Here is your license key:</p>
                  <div className="absolute flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-[14px] text-gray-900" style={box({ ...KEYBOX, y: KEYBOX.y - 36 })}>
                    <span className="select absolute inset-y-1 left-1 right-1 origin-left rounded bg-indigo-200/70" />
                    <span className="relative">{KEY}</span>
                  </div>
                  <p className="absolute left-10 top-[200px] text-[12px] text-gray-500">It works on 2 computers. Manage it any time in the Polar portal.</p>
                </div>

                {/* StepCrumb popup */}
                <div className="popup absolute rounded-xl bg-white p-3 shadow-float ring-1 ring-gray-200" style={box(POPUP)}>
                  <div className="flex items-center gap-1.5">
                    <Mark className="h-4 w-4" />
                    <span className="text-[12px] font-semibold">StepCrumb</span>
                    <span className="rounded-full bg-amber-50 px-1.5 text-[9px] font-semibold text-amber-800">Free</span>
                  </div>
                  <div className="mt-3 rounded-lg bg-[#4f46e5] py-1.5 text-center text-[11px] font-semibold text-white">Upgrade to Pro</div>
                  <div className="enter absolute flex items-center justify-center rounded-md text-[11px] font-semibold text-gray-600" style={box({ x: ENTER.x - POPUP.x, y: ENTER.y - POPUP.y, w: ENTER.w, h: ENTER.h })}>
                    Enter license key
                  </div>
                </div>

                {/* StepCrumb license screen */}
                <div className="license absolute inset-x-0 bottom-0 top-[36px] bg-[#f6f7f9]">
                  <div className="absolute rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200" style={{ left: 136, top: 70, width: 368, height: 250 }}>
                    <p className="text-[16px] font-bold text-gray-900">StepCrumb Pro</p>
                    <p className="mt-1 text-[11px] text-gray-500">Already bought? Enter your license key</p>
                  </div>
                  <div className="f-input absolute flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white px-2.5 font-mono text-[11px] text-gray-900" style={box({ ...INPUT, y: INPUT.y - 36 })}>
                    <span className="typed whitespace-nowrap" />
                  </div>
                  <div className="activate absolute flex items-center justify-center rounded-lg bg-gray-100 text-[12px] font-semibold text-gray-800 ring-1 ring-gray-200" style={box({ ...ACTIVATE, y: ACTIVATE.y - 36 })}>
                    <span className="activate-label">Activate</span>
                  </div>
                  <div className="pro absolute rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200" style={{ left: 156, top: 212, width: 328, height: 76 }}>
                    <p className="text-[13px] font-semibold text-emerald-900">StepCrumb Pro · active</p>
                    <p className="mt-0.5 text-[11px] text-emerald-900">
                      Licensed to <b>you@example.com</b>
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-indigo-600">Manage subscription →</p>
                    <span className="burst absolute right-10 top-4" aria-hidden>
                      {Array.from({ length: 10 }, (_, i) => (
                        <i key={i} className="absolute block h-2 w-2 rounded-full" style={{ background: ['#6366f1', '#f97316', '#10b981', '#f43f5e', '#eab308'][i % 5] }} />
                      ))}
                    </span>
                  </div>
                </div>

                {/* Keyboard hint, click ripple and cursor */}
                <span className="kbd pointer-events-none absolute left-0 top-0 rounded-md bg-gray-900 px-2 py-1 font-mono text-[11px] font-semibold text-white shadow-lg" />
                <span className="ripple pointer-events-none absolute -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-indigo-500 bg-indigo-400/20" />
                <svg className="cursor pointer-events-none absolute left-0 top-0 h-[26px] w-[20px] drop-shadow" viewBox="0 0 18 27" style={{ transformOrigin: '0 0' }}>
                  <path d="M0 0v23l6-5.5 4.5 9.5 4-1.8-4.3-9.2H18z" fill="#111827" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="caption pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="max-w-[92%] truncate rounded-xl bg-gray-900/90 px-3 py-2 text-[11px] font-semibold text-white shadow-lg sm:text-[13px]">
                <span className="caption-text" />
              </div>
            </div>
          </div>
        </div>

        {/* Steps panel, in sync with the demo */}
        <div className="absolute bottom-[4%] left-[5%] right-[5%] rounded-2xl bg-white/90 p-3 text-left shadow-float backdrop-blur sm:bottom-auto sm:left-auto sm:right-[4%] sm:top-[14%] sm:w-[25%]">
          <p className="mb-2 text-[12px] font-semibold text-gray-900">Activate Pro</p>
          <div className="space-y-1.5">
            {ACTIVATE_STEPS.map((s, i) => (
              <div key={s} className="astep flex items-center gap-2 rounded-lg bg-gray-50 p-1.5">
                <span className="num grid h-5 w-5 flex-none place-items-center rounded-full bg-gray-400 text-[10px] font-bold text-white">{i + 1}</span>
                <span className="text-[11px] leading-tight text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
