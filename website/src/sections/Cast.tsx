// The Crumbs: StepCrumb's characters. Each one is a job the product does, and
// together they explain the name: every click leaves a crumb. Flat SVG, so they
// stay sharp and light; GSAP moves them. Eyes follow the visitor's pointer and
// blink now and then; everything rests still with reduced motion.
import { gsap } from 'gsap'
import { useEffect, type ReactNode } from 'react'
import { reducedMotion } from '../motion'

export type CrumbKind = 'click' | 'snap' | 'shh' | 'echo' | 'zoom' | 'doc' | 'guide'

export const CAST: { kind: CrumbKind; name: string; job: string; color: string }[] = [
  { kind: 'click', name: 'Click', job: 'Catches every click', color: '#F97316' },
  { kind: 'snap', name: 'Snap', job: 'Takes the screenshots', color: '#6366F1' },
  { kind: 'shh', name: 'Shh', job: 'Blurs anything private', color: '#64748B' },
  { kind: 'echo', name: 'Echo', job: 'Reads it out loud', color: '#A855F7' },
  { kind: 'zoom', name: 'Zoom', job: 'Zooms where you click', color: '#0EA5E9' },
  { kind: 'doc', name: 'Doc', job: 'Writes the guide and SOP', color: '#F5E6C8' },
  { kind: 'guide', name: 'Guide', job: 'Shows people the way', color: '#EC4899' },
]

const INK = '#151412'

// Two pill eyes, in a group the pointer tracker moves (data-eyes) and the
// blinker squashes (.blink).
function Eyes({ y = 50, gap = 13, w = 7, h = 13, color = '#fff', glasses = false }: { y?: number; gap?: number; w?: number; h?: number; color?: string; glasses?: boolean }) {
  return (
    <g data-eyes="">
      <g className="blink" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        {glasses ? (
          <>
            <rect x={50 - gap - 10} y={y - 7} width="20" height="13" rx="5" fill={INK} />
            <rect x={50 + gap - 10} y={y - 7} width="20" height="13" rx="5" fill={INK} />
            <rect x={50 - gap + 9} y={y - 3} width={2 * gap - 18} height="3" rx="1.5" fill={INK} />
            <rect x={50 - gap - 6} y={y - 4.5} width="5" height="2.4" rx="1.2" fill="#fff" opacity=".7" />
            <rect x={50 + gap - 6} y={y - 4.5} width="5" height="2.4" rx="1.2" fill="#fff" opacity=".7" />
          </>
        ) : (
          <>
            <rect x={50 - gap - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={color} />
            <rect x={50 + gap - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={color} />
          </>
        )}
      </g>
    </g>
  )
}

const Smile = ({ y = 66, color = '#fff' }: { y?: number; color?: string }) => <path d={`M43 ${y} q7 6 14 0`} stroke={color} strokeWidth="3.4" fill="none" strokeLinecap="round" />

// One Crumb. `size` in px; the drawing is 100x100 with a little room above for hats.
export function Crumb({ kind, size = 64, smile = true, className = '' }: { kind: CrumbKind; size?: number; smile?: boolean; className?: string }) {
  let body: ReactNode
  switch (kind) {
    case 'click':
      body = (
        <>
          <circle cx="50" cy="56" r="40" fill="#F97316" />
          <ellipse cx="36" cy="34" rx="9" ry="5" fill="#fff" opacity=".22" transform="rotate(-25 36 34)" />
          <Eyes y={52} />
          {smile && <Smile y={67} />}
        </>
      )
      break
    case 'snap':
      body = (
        <>
          <rect x="33" y="12" width="22" height="12" rx="5" fill="#4F46E5" />
          <rect x="12" y="20" width="76" height="70" rx="24" fill="#6366F1" />
          <circle cx="74" cy="34" r="5" fill="#C7D2FE" />
          <Eyes y={55} />
          {smile && <Smile y={70} />}
        </>
      )
      break
    case 'shh':
      body = (
        <>
          <path d="M50 14c22 0 38 16 38 38 0 24-17 38-38 38S12 76 12 52c0-22 16-38 38-38z" fill="#64748B" />
          <Eyes y={50} gap={15} glasses />
          <path d="M44 70 h12" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        </>
      )
      break
    case 'echo':
      body = (
        <>
          <path d="M22 50a28 28 0 0 1 56 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="58" rx="36" ry="32" fill="#A855F7" />
          <rect x="10" y="44" width="14" height="22" rx="7" fill={INK} />
          <rect x="76" y="44" width="14" height="22" rx="7" fill={INK} />
          <Eyes y={55} gap={12} />
          {smile && <ellipse cx="50" cy="71" rx="5" ry="4" fill="#fff" />}
        </>
      )
      break
    case 'zoom':
      body = (
        <>
          <rect x="62" y="70" width="10" height="26" rx="5" fill={INK} transform="rotate(-40 67 83)" />
          <circle cx="46" cy="48" r="36" fill="#0EA5E9" />
          <circle cx="46" cy="48" r="20" fill="#E0F2FE" stroke="#fff" strokeWidth="4" />
          <g data-eyes="">
            <g className="blink" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle cx="46" cy="48" r="9" fill={INK} />
              <circle cx="49" cy="45" r="3" fill="#fff" />
            </g>
          </g>
        </>
      )
      break
    case 'doc':
      body = (
        <>
          <path d="M18 14h46l20 20v52a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#FFF7E6" stroke="#E7D7B8" strokeWidth="3" />
          <path d="M64 14v14a6 6 0 0 0 6 6h14" fill="#F5E6C8" stroke="#E7D7B8" strokeWidth="3" />
          <Eyes y={46} color={INK} w={6} h={11} />
          {smile && <Smile y={60} color={INK} />}
          <rect x="26" y="72" width="40" height="4" rx="2" fill="#E7D7B8" />
          <rect x="26" y="80" width="28" height="4" rx="2" fill="#E7D7B8" />
        </>
      )
      break
    case 'guide':
      body = (
        <>
          <path d="M50 10c4 0 7 2 9 6l30 58c4 8-1 16-10 16H21c-9 0-14-8-10-16l30-58c2-4 5-6 9-6z" fill="#EC4899" />
          <Eyes y={58} gap={11} w={6.5} h={12} />
          {smile && <Smile y={73} />}
        </>
      )
      break
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`crumb overflow-visible ${className}`} data-crumb={kind} aria-hidden>
      <ellipse cx="50" cy="96" rx="30" ry="4" fill={INK} opacity=".08" className="crumb-shadow" />
      <g className="crumb-body" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
        {body}
      </g>
    </svg>
  )
}

// ---------- the eyes: follow the pointer, look at buttons, blink ----------

export function useCrumbEyes() {
  useEffect(() => {
    if (reducedMotion()) return
    let px = innerWidth / 2
    let py = innerHeight / 3
    let override: { x: number; y: number } | null = null
    let raf = 0
    const update = () => {
      raf = 0
      const tx = override?.x ?? px
      const ty = override?.y ?? py
      document.querySelectorAll<SVGGElement>('[data-eyes]').forEach((g) => {
        const svg = g.ownerSVGElement
        if (!svg) return
        const r = svg.getBoundingClientRect()
        if (r.bottom < 0 || r.top > innerHeight) return
        const dx = tx - (r.left + r.width / 2)
        const dy = ty - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 260)
        g.setAttribute('transform', `translate(${((dx / d) * 6 * k).toFixed(2)} ${((dy / d) * 5 * k).toFixed(2)})`)
      })
    }
    const queue = () => (raf ||= requestAnimationFrame(update))
    const onMove = (e: PointerEvent) => {
      px = e.clientX
      py = e.clientY
      queue()
    }
    // Hover a call to action: every Crumb turns to look at it.
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-crumb-look]')
      if (el) {
        const r = el.getBoundingClientRect()
        override = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      } else override = null
      queue()
    }
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('pointerover', onOver, { passive: true })
    addEventListener('scroll', queue, { passive: true })
    // Blink: a random Crumb now and then, sometimes twice.
    const blink = window.setInterval(() => {
      const all = document.querySelectorAll('.crumb .blink')
      if (!all.length) return
      const el = all[Math.floor(Math.random() * all.length)]
      gsap.timeline().to(el, { scaleY: 0.1, duration: 0.07, yoyo: true, repeat: Math.random() < 0.3 ? 3 : 1, ease: 'power1.inOut' })
    }, 900)
    queue()
    return () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerover', onOver)
      removeEventListener('scroll', queue)
      window.clearInterval(blink)
      cancelAnimationFrame(raf)
    }
  }, [])
}

// A little hop with squash and stretch: the Crumbs' signature move.
export function hop(tl: gsap.core.Timeline, el: Element, at: gsap.Position, height = 26) {
  const body = el.querySelector('.crumb-body')
  tl.to(body, { scaleY: 0.82, scaleX: 1.12, duration: 0.12, ease: 'power2.out' }, at)
    .to(el, { y: -height, duration: 0.28, ease: 'power2.out' }, '>')
    .to(body, { scaleY: 1.08, scaleX: 0.94, duration: 0.2 }, '<')
    .to(el, { y: 0, duration: 0.24, ease: 'power2.in' }, '>')
    .to(body, { scaleY: 0.86, scaleX: 1.1, duration: 0.1, ease: 'power2.out' }, '>')
    .to(body, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.32)' }, '>')
  return tl
}

// Poke a Crumb (click it): it jumps, wobbles and blinks. The event 'crumb-poke'
// lets its 3D twin spin along.
export function useCrumbPoke() {
  useEffect(() => {
    if (reducedMotion()) return
    const on = (e: PointerEvent) => {
      if (e.button !== 0) return
      const svg = (e.target as Element | null)?.closest?.('svg.crumb') as SVGSVGElement | null
      if (!svg || gsap.isTweening(svg)) return
      const body = svg.querySelector('.crumb-body')
      const tl = gsap.timeline()
      tl.to(body, { scaleY: 0.75, scaleX: 1.18, duration: 0.1, ease: 'power2.out' })
        .to(svg, { y: -34, duration: 0.3, ease: 'power2.out' }, '>')
        .to(body, { scaleY: 1.12, scaleX: 0.9, rotation: gsap.utils.random([-14, 14]), duration: 0.22 }, '<')
        .to(svg, { y: 0, duration: 0.26, ease: 'power2.in' }, '>')
        .to(body, { scaleY: 0.8, scaleX: 1.14, rotation: 0, duration: 0.1, ease: 'power2.out' }, '>')
        .to(body, { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'elastic.out(1.2, 0.28)' }, '>')
      const eyes = svg.querySelector('.blink')
      if (eyes) gsap.to(eyes, { scaleY: 0.1, duration: 0.07, yoyo: true, repeat: 1, delay: 0.05 })
      svg.dispatchEvent(new Event('crumb-poke'))
    }
    addEventListener('pointerdown', on)
    return () => removeEventListener('pointerdown', on)
  }, [])
}
