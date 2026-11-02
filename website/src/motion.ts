import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef, type RefObject } from 'react'

gsap.registerPlugin(ScrollTrigger)

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Builds a looping GSAP timeline scoped to `ref`, pausing it while off screen.
// With reduced motion, the timeline jumps to `restAt` (0..1) and stays still.
export function useLoop(build: (root: HTMLElement) => gsap.core.Timeline, restAt = 0.7): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let tl: gsap.core.Timeline | undefined
    const ctx = gsap.context(() => {
      tl = build(root)
    }, root)
    if (reducedMotion()) {
      tl?.progress(restAt).pause()
      return () => ctx.revert()
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tl?.play() : tl?.pause()), { threshold: 0.15 })
    io.observe(root)
    return () => {
      io.disconnect()
      ctx.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}

// Fades and lifts elements marked [data-reveal] into view as you scroll.
export function useReveal() {
  useEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.set('[data-reveal]', { autoAlpha: 0, y: 40 })
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true }),
      })
    })
    return () => ctx.revert()
  }, [])
}

// Types text into an element over `duration` seconds inside a timeline.
export function typeInto(tl: gsap.core.Timeline, el: Element, text: string, duration: number, at?: gsap.Position) {
  const o = { n: 0 }
  tl.to(o, { n: text.length, duration, ease: 'none', onUpdate: () => (el.textContent = text.slice(0, Math.round(o.n))) }, at)
}
