// The "crumb trail": StepCrumb's brand motif. Every click leaves a crumb; the
// crumbs link into a path anyone can follow. Same three colours as the logo.
import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'
import { reducedMotion, useLoop } from '../motion'

const ORANGE = '#F97316'
const INDIGO = '#818CF8'
const INK = '#151412'

// A wandering path across the hero: crumbs drop one by one as "clicks", the
// trail draws between them, and it ends in a finished guide.
const PATH = 'M20 96 C 170 20, 270 140, 440 78 S 720 8, 900 66'
const STOPS = [
  { at: 0.04, label: 'Open Contacts' },
  { at: 0.3, label: 'Click New' },
  { at: 0.56, label: 'Type the name' },
  { at: 0.8, label: 'Save' },
]

export function HeroTrail() {
  const ref = useLoop((root) => {
    const path = root.querySelector<SVGPathElement>('.trail')!
    const len = path.getTotalLength()
    const crumbs = root.querySelectorAll('.crumb')
    const labels = root.querySelectorAll('.crumb-label')
    const done = root.querySelector('.trail-done')
    gsap.set(path, { strokeDasharray: `2 9`, strokeDashoffset: 0 })
    const mask = root.querySelector<SVGPathElement>('.trail-mask')!
    gsap.set(mask, { strokeDasharray: len, strokeDashoffset: len })
    gsap.set([crumbs, labels, done], { autoAlpha: 0 })
    gsap.set(crumbs, { scale: 0, transformOrigin: '50% 50%' })
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 })
    STOPS.forEach((s, i) => {
      const t = i * 0.75
      tl.to(mask, { strokeDashoffset: len * (1 - s.at), duration: 0.6, ease: 'power2.inOut' }, t)
      tl.to(crumbs[i], { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, t + 0.5)
      tl.to(labels[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, t + 0.55)
    })
    tl.to(mask, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, STOPS.length * 0.75)
    tl.fromTo(done, { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, STOPS.length * 0.75 + 0.5)
    tl.to([crumbs, labels, done], { autoAlpha: 0, duration: 0.4 }, '+=2.2')
    tl.set(mask, { strokeDashoffset: len })
    return tl
  }, 0.85)

  // Crumb positions along the path (computed once in the browser).
  const pts = useRef<{ x: number; y: number }[]>([])
  if (typeof document !== 'undefined' && !pts.current.length) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', PATH)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.appendChild(p)
    svg.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'
    document.body.appendChild(svg)
    const L = p.getTotalLength()
    pts.current = [...STOPS.map((s) => p.getPointAtLength(L * s.at)), p.getPointAtLength(L)].map((q) => ({ x: q.x, y: q.y }))
    svg.remove()
  }
  const end = pts.current[STOPS.length] ?? { x: 900, y: 66 }

  return (
    <div ref={ref} className="pointer-events-none mx-auto mt-10 hidden max-w-[980px] sm:block" aria-hidden>
      <svg viewBox="0 0 960 150" className="w-full overflow-visible">
        <defs>
          <mask id="trail-reveal" maskUnits="userSpaceOnUse">
            <path className="trail-mask" d={PATH} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
          </mask>
        </defs>
        <path className="trail" d={PATH} fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" mask="url(#trail-reveal)" />
        {pts.current.slice(0, STOPS.length).map((q, i) => (
          <g key={i}>
            <g className="crumb">
              <circle cx={q.x} cy={q.y} r="13" fill={i % 2 ? INDIGO : ORANGE} />
              <text x={q.x} y={q.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Inter, sans-serif">
                {i + 1}
              </text>
            </g>
            <g className="crumb-label" transform={`translate(0 ${i % 2 ? 6 : -6})`}>
              <rect x={q.x - 58} y={i % 2 ? q.y + 20 : q.y - 50} width="116" height="28" rx="14" fill="#fff" stroke="#E7E2D9" />
              <text x={q.x} y={i % 2 ? q.y + 38.5 : q.y - 31.5} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={INK} fontFamily="Inter, sans-serif">
                {STOPS[i].label}
              </text>
            </g>
          </g>
        ))}
        <g className="trail-done">
          <rect x={end.x - 8} y={end.y - 30} width="62" height="60" rx="10" fill="#fff" stroke="#E7E2D9" />
          <rect x={end.x + 2} y={end.y - 20} width="34" height="5" rx="2.5" fill={INK} opacity=".75" />
          <rect x={end.x + 2} y={end.y - 9} width="42" height="4" rx="2" fill="#E7E2D9" />
          <rect x={end.x + 2} y={end.y + 1} width="38" height="4" rx="2" fill="#E7E2D9" />
          <rect x={end.x + 2} y={end.y + 11} width="30" height="4" rx="2" fill="#E7E2D9" />
          <circle cx={end.x + 50} cy={end.y - 28} r="11" fill="#16A34A" />
          <path d={`M${end.x + 45} ${end.y - 28} l3.5 3.5 6.5 -7`} stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}

// A short dotted trail between sections that draws itself as you scroll past,
// ending in a crumb.
export function TrailDivider({ color = ORANGE }: { color?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg || reducedMotion()) return
    const line = svg.querySelector('.reveal-line')
    const dot = svg.querySelector('.reveal-dot')
    const ctx = gsap.context(() => {
      gsap.fromTo(line, { attr: { y2: 0 } }, { attr: { y2: 96 }, ease: 'none', scrollTrigger: { trigger: svg, start: 'top 85%', end: 'bottom 55%', scrub: true } })
      gsap.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, ease: 'back.out(3)', scrollTrigger: { trigger: svg, start: 'bottom 60%', toggleActions: 'play none none reverse' } })
    })
    return () => ctx.revert()
  }, [])
  return (
    <div className="flex justify-center py-2" aria-hidden>
      <svg ref={ref} width="20" height="120" viewBox="0 0 20 120">
        <line className="reveal-line" x1="10" y1="0" x2="10" y2="96" stroke={INK} strokeOpacity=".3" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
        <circle className="reveal-dot" cx="10" cy="108" r="7" fill={color} />
      </svg>
    </div>
  )
}

// Clicking anywhere on the page drops a crumb, the way StepCrumb turns each
// click into a step. Desktop pointers only; skipped with reduced motion.
export function useCrumbClicks() {
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const colors = [ORANGE, INDIGO, ORANGE]
    let n = 0
    const on = (e: PointerEvent) => {
      if (e.button !== 0) return
      const c = document.createElement('span')
      c.setAttribute('aria-hidden', 'true')
      const size = 9 + (n % 3) * 2
      c.style.cssText = `position:fixed;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${colors[n++ % 3]};pointer-events:none;z-index:9999`
      document.body.appendChild(c)
      gsap.fromTo(c, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' })
      gsap.to(c, { y: 18, autoAlpha: 0, duration: 0.7, delay: 0.45, ease: 'power2.in', onComplete: () => c.remove() })
    }
    window.addEventListener('pointerdown', on)
    return () => window.removeEventListener('pointerdown', on)
  }, [])
}

// Three crumbs rising, as in the logo: a small brand mark for headings.
export function CrumbMark({ className = 'h-5 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" className={className} aria-hidden>
      <path d="M8 18 L30 12 L52 6" stroke={INK} strokeOpacity=".25" strokeWidth="1.5" strokeDasharray="1.5 4" strokeLinecap="round" />
      <circle cx="8" cy="18" r="4" fill={ORANGE} />
      <circle cx="30" cy="12" r="5" fill="#E7E2D9" />
      <circle cx="52" cy="6" r="6" fill={INDIGO} />
    </svg>
  )
}

