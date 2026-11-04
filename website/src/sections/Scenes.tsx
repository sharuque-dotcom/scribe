// Scenes the Crumbs act out: the hero (a capture, start to finished guide), the
// three How it works steps, and the cast line-up that explains the name.
import { gsap } from 'gsap'
import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import { reducedMotion, useLoop, typeInto } from '../motion'
import { CAST, Crumb, hop, type CrumbKind } from './Cast'

// ---------- 3D: only where it runs well; otherwise the flat Crumbs stay ----------

const Crumbs3D = lazy(() => import('./Crumbs3D'))

let can3DCache: boolean | undefined
function can3D() {
  if (can3DCache !== undefined) return can3DCache
  can3DCache = false
  if (typeof window === 'undefined' || reducedMotion()) return false
  if (!matchMedia('(min-width: 900px) and (pointer: fine)').matches) return false
  if ((navigator.hardwareConcurrency ?? 0) < 4) return false
  if (new URLSearchParams(location.search).has('flat')) return false
  try {
    const c = document.createElement('canvas')
    can3DCache = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    // No WebGL: stay flat.
  }
  return can3DCache
}

// Mounts the 3D layer over `scene` once the page has settled.
function Layer3D({ scene }: { scene: RefObject<HTMLElement> }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!can3D()) return
    const go = () => setOn(true)
    const idle = typeof requestIdleCallback === 'function'
    const id = idle ? requestIdleCallback(go, { timeout: 2500 }) : window.setTimeout(go, 1200)
    return () => (idle ? cancelIdleCallback(id) : window.clearTimeout(id))
  }, [])
  return on ? (
    <Suspense fallback={null}>
      <Crumbs3D scene={scene} />
    </Suspense>
  ) : null
}

// ---------- Hero: the Crumbs capture a task and hand back a guide ----------

const START: Record<string, [string, string]> = {
  click: ['6%', '74%'],
  snap: ['22%', '75%'],
  shh: ['39%', '75%'],
  echo: ['57%', '74%'],
  doc: ['76%', '74%'],
}

export function HeroScene() {
  const ref = useLoop((root) => {
    const q = <T extends Element>(s: string) => root.querySelector(s) as T
    const c = (k: string) => q<HTMLElement>(`.c-${k}`)
    const crumbs = ['click', 'snap', 'shh', 'echo', 'doc'].map(c)
    const btn = q('.s-new')
    const ripple = q('.s-ripple')
    const foot = q('.s-foot')
    const flash = q('.s-flash')
    const shot = q('.s-shot')
    const email = q('.s-email')
    const blurTag = q('.s-blurtag')
    const caption = q('.s-caption')
    const captionText = q('.s-caption-text')
    const guide = q('.s-guide')
    const guideSteps = root.querySelectorAll('.s-guide-step')

    const reset = () => {
      Object.entries(START).forEach(([k, [l, t]]) => gsap.set(c(k), { left: l, top: t, y: 0 }))
      gsap.set([ripple], { scale: 0, autoAlpha: 0 })
      gsap.set([foot, shot, blurTag, caption, guide, guideSteps], { autoAlpha: 0 })
      gsap.set(flash, { autoAlpha: 0 })
      gsap.set(email, { filter: 'blur(0px)' })
      gsap.set(shot, { scale: 0.6, rotate: 0, x: 0, y: 0 })
      gsap.set(guide, { scale: 0.9, y: 10 })
      captionText.textContent = ''
    }
    reset()
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, onRepeat: reset })

    // Everyone bounces once to say hello.
    crumbs.forEach((el, i) => hop(tl, el, i * 0.08, 14))

    // 1. Click hops onto "+ New" and presses it: a ripple, and crumb ① drops.
    const t1 = 1.1
    tl.to(c('click'), { left: '66%', top: '-12%', duration: 0.75, ease: 'power2.inOut' }, t1)
    tl.to(c('click'), { y: -30, duration: 0.38, ease: 'power2.out', yoyo: true, repeat: 1 }, t1)
    tl.to(c('click').querySelector('.crumb-body'), { scaleY: 0.78, scaleX: 1.15, duration: 0.12, yoyo: true, repeat: 1 }, t1 + 0.78)
    tl.to(btn, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 }, t1 + 0.8)
    tl.fromTo(ripple, { scale: 0, autoAlpha: 0.7 }, { scale: 3, autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, t1 + 0.82)
    tl.fromTo(foot, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, t1 + 0.95)

    // 2. Snap flashes; a screenshot card pops out.
    const t2 = t1 + 1.4
    hop(tl, c('snap'), t2 - 0.2, 20)
    tl.fromTo(flash, { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, t2 + 0.3)
    tl.to(shot, { autoAlpha: 1, scale: 1, rotate: -7, x: -14, y: -6, duration: 0.5, ease: 'back.out(2)' }, t2 + 0.4)

    // 3. Shh walks to the email field and blurs it.
    const t3 = t2 + 1.2
    tl.to(c('shh'), { left: '74%', top: '27%', duration: 0.8, ease: 'power2.inOut' }, t3)
    tl.to(c('shh'), { y: -22, duration: 0.4, ease: 'power2.out', yoyo: true, repeat: 1 }, t3)
    tl.to(email, { filter: 'blur(5px)', duration: 0.5 }, t3 + 0.8)
    tl.fromTo(blurTag, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3 }, t3 + 0.95)

    // 4. Echo reads the step out loud; the caption types.
    const t4 = t3 + 1.4
    hop(tl, c('echo'), t4, 16)
    tl.fromTo(caption, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, t4 + 0.1)
    typeInto(tl, captionText, 'Click "+ New" to add a contact', 0.9, t4 + 0.3)

    // 5. Doc gathers everything into a finished guide; everyone celebrates.
    const t5 = t4 + 1.6
    // Click and Shh head back to the line-up; Doc steps forward.
    tl.to(c('click'), { left: START.click[0], top: START.click[1], duration: 0.7, ease: 'power2.inOut' }, t5 - 0.3)
    tl.to(c('shh'), { left: START.shh[0], top: START.shh[1], duration: 0.7, ease: 'power2.inOut' }, t5 - 0.3)
    hop(tl, c('doc'), t5, 22)
    tl.to(shot, { left: '34%', top: '22%', rotate: 0, x: 0, y: 0, scale: 0.6, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, t5 + 0.2)
    tl.to(caption, { y: -40, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, t5 + 0.25)
    tl.to(guide, { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)' }, t5 + 0.55)
    tl.to(guideSteps, { autoAlpha: 1, duration: 0.25, stagger: 0.15 }, t5 + 0.8)
    crumbs.forEach((el, i) => hop(tl, el, t5 + 1.1 + i * 0.07, 24))
    tl.to({}, { duration: 1.6 })
    return tl
  }, 0.94)

  return (
    <div ref={ref} className="relative mx-auto aspect-[5/4] w-full max-w-[560px] select-none" aria-hidden>
      {/* The app being documented */}
      <div className="absolute left-[4%] top-[4%] h-[60%] w-[92%] overflow-hidden rounded-[22px] border border-line bg-white shadow-float">
        <div className="flex h-[16%] items-center gap-2 border-b border-line px-[5%]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FCA5A5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FCD34D]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#86EFAC]" />
          <span className="ml-3 text-[clamp(11px,2.2vw,14px)] font-semibold">Contacts</span>
          <span className="s-new relative ml-auto rounded-full bg-brand px-3 py-1 text-[clamp(10px,2vw,13px)] font-semibold text-white">
            + New
            <span className="s-ripple absolute inset-0 rounded-full border-2 border-brand" />
            <span className="s-foot absolute -right-3 -top-3 grid h-6 w-6 place-items-center rounded-full bg-ember text-[11px] font-bold text-white ring-2 ring-white">1</span>
          </span>
        </div>
        <div className="space-y-[4%] px-[6%] pt-[6%] text-[clamp(10px,2vw,13px)]">
          {[
            ['Name', 'Sam Lee', ''],
            ['Email', 'sam@acme.io', 's-email'],
            ['Stage', 'Customer', ''],
          ].map(([l, v, cls]) => (
            <div key={l} className="flex items-center gap-3">
              <span className="w-[22%] text-soft">{l}</span>
              <span className="relative flex-1 rounded-lg border border-line bg-paper px-3 py-[1.6%]">
                <span className={cls}>{v}</span>
                {cls && <span className="s-blurtag absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">blurred</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="s-flash pointer-events-none absolute inset-0 bg-white" />
      </div>

      {/* The screenshot Snap takes */}
      <div className="s-shot absolute left-[-3%] top-[38%] w-[30%] rounded-xl border border-line bg-white p-1.5 shadow-card">
        <div className="h-2 w-1/2 rounded bg-ink/70" />
        <div className="mt-1.5 h-10 rounded-md bg-[linear-gradient(135deg,#EEF2FF,#FFF7ED)]">
          <div className="ml-auto mr-2 mt-2 inline-block h-3 w-8 rounded-full border-2 border-ember" />
        </div>
      </div>

      {/* The caption Echo reads */}
      <div className="s-caption absolute left-[12%] top-[60%] rounded-xl bg-ink px-3 py-2 text-[clamp(10px,2vw,13px)] font-medium text-white shadow-card">
        <span className="s-caption-text" />
      </div>

      {/* The finished guide */}
      <div className="s-guide absolute left-[16%] top-[10%] w-[68%] rounded-2xl border border-line bg-white p-[4%] shadow-float">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#16A34A] text-[13px] font-bold text-white">✓</span>
          <span className="text-[clamp(12px,2.4vw,16px)] font-semibold">How to add a contact</span>
        </div>
        {['Click "+ New"', 'Type the name', 'Type the email (blurred)'].map((s, i) => (
          <div key={s} className="s-guide-step mt-2 flex items-center gap-2 text-[clamp(10px,2vw,13px)] text-soft">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ember text-[10px] font-bold text-white">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      {/* The Crumbs */}
      {(['click', 'snap', 'shh', 'echo', 'doc'] as CrumbKind[]).map((k) => (
        <div key={k} className={`c-${k} absolute w-[16%]`} style={{ left: START[k][0], top: START[k][1] }}>
          <Crumb kind={k} size={100} className="h-auto w-full" />
        </div>
      ))}
      <Layer3D scene={ref} />
    </div>
  )
}

// ---------- How it works: one small scene per step ----------

function Stage({ tint, children, label }: { tint: string; children: React.ReactNode; label: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-line" style={{ background: tint }} aria-label={label} role="img">
      <div className="absolute inset-0 opacity-[.5] [background-image:radial-gradient(rgba(21,20,18,.12)_1px,transparent_1px)] [background-size:18px_18px]" />
      {children}
    </div>
  )
}

// 1. Press Start: Click jumps on the big record button; the others cheer.
export function SceneStart() {
  const ref = useLoop((root) => {
    const rec = root.querySelector('.rec')
    const dot = root.querySelector('.rec-dot')
    const rings = root.querySelectorAll('.rec-ring')
    const click = root.querySelector('.k-click')!
    const pals = root.querySelectorAll('.k-pal')
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
    tl.set(click, { left: '8%', top: '58%', y: 0 })
    tl.set(dot, { backgroundColor: '#D6D3D1', borderRadius: '50%', scale: 1 })
    tl.set(rings, { scale: 1, autoAlpha: 0 })
    tl.to(click, { left: '39%', top: '6%', duration: 0.7, ease: 'power2.inOut' }, 0.4)
    tl.to(click, { y: -40, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.4)
    tl.to(rec, { scale: 0.92, duration: 0.1, yoyo: true, repeat: 1 }, 1.1)
    tl.to(dot, { backgroundColor: '#EF4444', borderRadius: '30%', scale: 0.8, duration: 0.3 }, 1.15)
    tl.fromTo(rings, { scale: 1, autoAlpha: 0.6 }, { scale: 1.8, autoAlpha: 0, duration: 1, stagger: 0.3, ease: 'power2.out' }, 1.2)
    pals.forEach((p, i) => hop(tl, p, 1.3 + i * 0.12, 22))
    tl.to({}, { duration: 1.2 })
    return tl
  }, 0.6)
  return (
    <div ref={ref}>
      <Stage tint="#FFF4EC" label="Click jumps on the record button">
        <div className="rec absolute left-1/2 top-[56%] grid h-[38%] w-[29%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-card">
          <span className="rec-ring absolute inset-0 rounded-full border-2 border-[#EF4444]" />
          <span className="rec-ring absolute inset-0 rounded-full border-2 border-[#EF4444]" />
          <span className="rec-dot h-[42%] w-[42%]" />
        </div>
        <div className="k-click absolute w-[22%]">
          <Crumb kind="click" size={100} className="h-auto w-full" />
        </div>
        <div className="k-pal absolute left-[70%] top-[60%] w-[18%]">
          <Crumb kind="snap" size={100} className="h-auto w-full" />
        </div>
        <div className="k-pal absolute left-[82%] top-[66%] w-[15%]">
          <Crumb kind="echo" size={100} className="h-auto w-full" />
        </div>
      </Stage>
    </div>
  )
}

// 2. Click through: Click hops from button to button leaving numbered crumbs;
// Shh pops up and blurs a phone number.
export function SceneClick() {
  const ref = useLoop((root) => {
    const click = root.querySelector('.k-click')!
    const feet = root.querySelectorAll('.k-foot')
    const shh = root.querySelector('.k-shh')
    const phone = root.querySelector('.k-phone')
    const spots: [string, string][] = [
      ['10%', '20%'],
      ['40%', '20%'],
      ['70%', '20%'],
    ]
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
    tl.set(click, { left: '-25%', top: spots[0][1], y: 0 })
    tl.set(feet, { autoAlpha: 0, scale: 0 })
    tl.set(shh, { top: '100%' })
    tl.set(phone, { filter: 'blur(0px)' })
    spots.forEach(([l, t], i) => {
      const at = 0.3 + i * 0.75
      tl.to(click, { left: l, top: t, duration: 0.55, ease: 'power2.inOut' }, at)
      tl.to(click, { y: -26, duration: 0.27, ease: 'power2.out', yoyo: true, repeat: 1 }, at)
      tl.to(feet[i], { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, at + 0.55)
    })
    tl.to(shh, { top: '56%', duration: 0.45, ease: 'back.out(2)' }, 2.6)
    tl.to(phone, { filter: 'blur(4px)', duration: 0.4 }, 2.95)
    tl.to(click, { left: '120%', duration: 0.6, ease: 'power2.in' }, 3.6)
    tl.to({}, { duration: 1 })
    return tl
  }, 0.7)
  return (
    <div ref={ref}>
      <Stage tint="#EEF0FF" label="Click hops across buttons leaving numbered crumbs, and Shh blurs a phone number">
        {['Contacts', 'New', 'Save'].map((b, i) => (
          <div key={b} className="absolute top-[44%] grid w-[22%] place-items-center rounded-full bg-white py-[2.4%] text-[clamp(11px,1.4vw,14px)] font-semibold shadow-card" style={{ left: `${10 + i * 30}%` }}>
            {b}
            <span className="k-foot absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ember text-[11px] font-bold text-white ring-2 ring-white">{i + 1}</span>
          </div>
        ))}
        <div className="absolute left-[10%] top-[66%] rounded-lg bg-white px-3 py-1.5 text-[clamp(11px,1.4vw,14px)] shadow-card">
          Phone <span className="k-phone ml-1 font-semibold">+971 50 123 4567</span>
        </div>
        <div className="k-click absolute w-[20%]">
          <Crumb kind="click" size={100} className="h-auto w-full" />
        </div>
        <div className="k-shh absolute left-[66%] w-[22%]">
          <Crumb kind="shh" size={100} className="h-auto w-full" />
        </div>
      </Stage>
    </div>
  )
}

// 3. Get everything: a parade of Crumbs carries the four results to their places.
export function SceneEverything() {
  const ref = useLoop((root) => {
    const walkers = root.querySelectorAll<HTMLElement>('.k-walker')
    const items = root.querySelectorAll('.k-item')
    const slots = root.querySelectorAll('.k-slot')
    const landed = root.querySelectorAll('.k-landed')
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
    tl.set(walkers, { left: '-30%', y: 0 })
    tl.set(items, { y: 0, autoAlpha: 1 })
    tl.set(landed, { autoAlpha: 0, scale: 0.5 })
    tl.set(slots, { borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,.5)' })
    walkers.forEach((w, i) => {
      const at = 0.2 + i * 0.35
      const left = `${4 + i * 24}%`
      tl.to(w, { left, duration: 1, ease: 'power1.inOut' }, at)
      for (let s = 0; s < 3; s++) tl.to(w, { y: -12, duration: 0.16, yoyo: true, repeat: 1, ease: 'power1.out' }, at + s * 0.33)
      tl.to(items[i], { y: '-118%', duration: 0.35, ease: 'power2.out' }, at + 1.1)
      tl.to(slots[i], { borderStyle: 'solid', backgroundColor: '#fff', duration: 0.2 }, at + 1.3)
      tl.to(items[i], { autoAlpha: 0, duration: 0.15 }, at + 1.35)
      tl.to(landed[i], { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, at + 1.35)
    })
    walkers.forEach((w, i) => hop(tl, w, 2.9 + i * 0.08, 20))
    tl.to({}, { duration: 1.2 })
    return tl
  }, 0.95)
  const things: [CrumbKind, string, IconKind][] = [
    ['doc', 'Guide', 'guide'],
    ['snap', 'SOP', 'sop'],
    ['guide', 'Training', 'training'],
    ['echo', 'Video', 'video'],
  ]
  return (
    <div ref={ref}>
      <Stage tint="#FDF0F7" label="Four Crumbs carry the guide, SOP, training and video to their places">
        {things.map(([, label, icon], i) => (
          <div key={label} className="k-slot absolute top-[10%] flex h-[34%] w-[20%] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#F0C2DC] text-center" style={{ left: `${4 + i * 24}%` }}>
            <span className="k-landed opacity-0">
              <Icon kind={icon} />
            </span>
            <span className="text-[clamp(11px,1.3vw,14px)] font-semibold">{label}</span>
          </div>
        ))}
        {things.map(([k, label, icon]) => (
          <div key={k} className="k-walker absolute top-[58%] w-[20%]">
            <div className="k-item absolute -top-[46%] left-1/2 grid h-[42%] w-[56%] -translate-x-1/2 place-items-center rounded-lg bg-white shadow-card" aria-label={label}>
              <Icon kind={icon} />
            </div>
            <Crumb kind={k} size={100} className="h-auto w-full" />
          </div>
        ))}
      </Stage>
    </div>
  )
}

type IconKind = 'guide' | 'sop' | 'training' | 'video'
// Tiny drawn icons for the four results (emoji look different on every computer).
function Icon({ kind }: { kind: IconKind }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: '#151412', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'guide') return (<svg {...common}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><circle cx="10" cy="13" r="1.2" fill="#F97316" stroke="none" /><path d="M12.5 13h4M10 17h6.5" /></svg>)
  if (kind === 'sop') return (<svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M8.5 10l1.5 1.5 3-3M8.5 16l1.5 1.5 3-3" stroke="#6366F1" /></svg>)
  if (kind === 'training') return (<svg {...common}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" stroke="#EC4899" /></svg>)
  return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9l5 3-5 3z" fill="#A855F7" stroke="none" /></svg>)
}

// ---------- Meet the Crumbs: why the name ----------

export function MeetTheCrumbs() {
  const ref = useLoop((root) => {
    const all = root.querySelectorAll('.cast-member')
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.5 })
    all.forEach((el, i) => hop(tl, el.querySelector('.cast-body')!, i * 0.12, 18))
    return tl
  }, 0)
  // The line-up drops in one by one as it scrolls into view, with a bounce.
  const grid = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = grid.current
    if (!root || reducedMotion()) return
    let tw: gsap.core.Tween | undefined
    const ctx = gsap.context(() => {
      tw = gsap.from(root.querySelectorAll('.cast-drop'), { y: -160, autoAlpha: 0, duration: 1.1, ease: 'bounce.out', stagger: 0.09, paused: true })
    }, root)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      tw?.play()
      io.disconnect()
    }, { rootMargin: '0px 0px -15% 0px' })
    io.observe(root)
    return () => {
      io.disconnect()
      ctx.revert()
    }
  }, [])
  return (
    <section className="mx-auto max-w-[1240px] px-5 pt-24 sm:px-8 sm:pt-32" aria-labelledby="meet">
      <div className="mx-auto max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">Why StepCrumb?</p>
        <h2 id="meet" className="display text-[40px] sm:text-[58px]">
          Every click leaves a crumb.
          <br />
          <span className="font-serif font-normal italic tracking-normal">Meet the Crumbs.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-soft">While you work, a small crew follows your trail. Each one has a job, and together they turn your clicks into something anyone can follow.</p>
      </div>
      <div ref={grid} className="relative mt-14">
       <div ref={ref} className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4 lg:grid-cols-7">
        {CAST.map((m) => (
          <div key={m.kind} className="cast-member group text-center">
            <div className="cast-drop mx-auto w-[88px]">
              <div className="cast-body transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-[-4deg]">
                <Crumb kind={m.kind} size={100} className="h-auto w-full" />
              </div>
            </div>
            <p className="mt-3 text-[17px] font-semibold">{m.name}</p>
            <p className="text-[14px] text-soft">{m.job}</p>
          </div>
        ))}
       </div>
       <Layer3D scene={grid} />
      </div>
    </section>
  )
}

