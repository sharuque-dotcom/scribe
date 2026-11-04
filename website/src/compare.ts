// Comparison pages: static HTML (readable without JavaScript) with the site's
// styles and the crumb-click touch.
import './index.css'
import { gsap } from 'gsap'
import { inject } from '@vercel/analytics'

// Vercel Web Analytics: page views only, no cookies, nothing personal.
inject()

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.matchMedia('(pointer: fine)').matches) {
  let n = 0
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const c = document.createElement('span')
    const size = 9 + (n % 3) * 2
    c.style.cssText = `position:fixed;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${n++ % 2 ? '#818CF8' : '#F97316'};pointer-events:none;z-index:9999`
    document.body.appendChild(c)
    gsap.fromTo(c, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' })
    gsap.to(c, { y: 18, autoAlpha: 0, duration: 0.7, delay: 0.45, ease: 'power2.in', onComplete: () => c.remove() })
  })
}
