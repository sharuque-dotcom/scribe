import { useEffect, useState } from 'react'
import { CONFIG } from '../config'
import { HeroDemo } from './HeroDemo'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2 ${className}`} aria-label="StepCrumb home">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#151412" />
        <circle cx="18" cy="44" r="6" fill="#F97316" />
        <circle cx="32" cy="32" r="7.5" fill="#FAF8F4" />
        <circle cx="46" cy="18" r="9" fill="#818CF8" />
      </svg>
      <span className="text-[19px] font-semibold tracking-tight">StepCrumb</span>
    </a>
  )
}

// The Chrome logo: three segments, each bounded by a line tangent to the inner circle.
const CHROME_SEGMENTS = (() => {
  const c = 24, R = 22, r = 10, d = Math.sqrt(R * R - r * r)
  const rad = (deg: number) => (deg * Math.PI) / 180
  const pts = [0, 1, 2].map((k) => {
    const a = rad(-90 + 120 * k)
    const dir = rad(120 * k)
    const t = [c + r * Math.cos(a), c + r * Math.sin(a)]
    return { t, p: [t[0] + d * Math.cos(dir), t[1] + d * Math.sin(dir)] }
  })
  const f = (n: number) => n.toFixed(2)
  return ['#EA4335', '#FBBC04', '#34A853'].map((fill, k) => {
    const a = pts[k]
    const b = pts[(k + 2) % 3]
    return { fill, d: `M${f(a.t[0])} ${f(a.t[1])}L${f(a.p[0])} ${f(a.p[1])}A${R} ${R} 0 0 0 ${f(b.p[0])} ${f(b.p[1])}L${f(b.t[0])} ${f(b.t[1])}A${r} ${r} 0 0 1 ${f(a.t[0])} ${f(a.t[1])}Z` }
  })
})()

export const ChromeIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={`flex-none ${className}`} aria-hidden>
    {CHROME_SEGMENTS.map((s) => (
      <path key={s.fill} d={s.d} fill={s.fill} />
    ))}
    <circle cx="24" cy="24" r="10" fill="#fff" />
    <circle cx="24" cy="24" r="8" fill="#1A73E8" />
  </svg>
)

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled ? 'border-b border-line bg-paper/85 backdrop-blur-md' : 'bg-transparent'}`}>
      <nav className="mx-auto flex max-w-[1240px] items-center gap-6 px-5 py-4 sm:px-8">
        <Logo />
        <div className="ml-6 hidden items-center gap-7 text-[15px] text-ink/80 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#compare" className="hover:text-ink">Compare</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="#pricing" className="hidden rounded-full border border-ink/80 px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper sm:inline-flex">
            Lifetime · ${CONFIG.founding.price}
          </a>
          <a href={CONFIG.chromeStoreUrl} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90">
            <ChromeIcon className="h-4 w-4" /> Add to Chrome
          </a>
        </div>
      </nav>
    </header>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft colour wash behind the hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(129,140,248,.22),transparent_70%),radial-gradient(40%_40%_at_85%_20%,rgba(249,115,22,.12),transparent_70%)]" />
      <div className="mx-auto max-w-[1240px] px-5 pt-12 text-center sm:px-8 lg:pt-20">
        <a href="#features" className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[13px] font-medium text-soft shadow-sm backdrop-blur hover:text-ink" data-hero>
          <span className="rounded-full bg-ember px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
          Narrated videos, made on your computer →
        </a>
        <h1 className="display mx-auto max-w-5xl text-[54px] sm:text-[84px] lg:text-[104px]" data-hero>
          Show it once.
          <br />
          <span className="bg-gradient-to-r from-brand via-violet-500 to-ember bg-clip-text text-transparent">Explain it forever.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-[18px] leading-relaxed text-soft sm:text-[20px]" data-hero>
          Click through any task in your browser. StepCrumb turns it into a <b className="font-semibold text-ink">step-by-step guide</b>, an <b className="font-semibold text-ink">SOP</b>, a <b className="font-semibold text-ink">training module</b> and a <b className="font-semibold text-ink">narrated video</b> that zooms where you click. Nothing you capture leaves your computer.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3" data-hero>
          <a href={CONFIG.chromeStoreUrl} className="btn-dark px-7 py-3.5 text-[16px]">
            <ChromeIcon /> Add to Chrome, it's free
          </a>
          <a href={CONFIG.checkoutUrl} className="btn-ghost px-7 py-3.5 text-[16px]">
            Lifetime access · ${CONFIG.founding.price}
          </a>
        </div>
        <p className="mt-4 text-[13px] text-soft" data-hero>
          Chrome & Edge · Windows, Mac, Linux, ChromeOS · No account needed
        </p>
      </div>
      <div className="mx-auto mt-14 max-w-[1180px] px-3 sm:px-8" data-hero>
        <HeroDemo />
      </div>
    </section>
  )
}

const PLACES = ['CRMs', 'ERPs', 'HR portals', 'Admin consoles', 'Banking dashboards', 'Ticketing tools', 'EHR systems', 'Spreadsheets', 'Marketing tools', 'Internal apps', 'Supplier portals', 'Government sites']

export function Strip() {
  return (
    <section className="border-y border-line bg-white/50 py-6" aria-label="Works anywhere">
      <div className="relative overflow-hidden">
        <div className="marquee flex w-max gap-10 whitespace-nowrap text-[15px] text-soft">
          {[...PLACES, ...PLACES].map((p, i) => (
            <span key={i} className="flex items-center gap-10">
              {p}
              <span className="text-ember" aria-hidden>
                ●
              </span>
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
      </div>
      <p className="mt-3 text-center text-[13px] text-soft">Works on any website you can open in Chrome or Edge.</p>
    </section>
  )
}

const HOW = [
  ['Press Start', 'Open the site you want to explain and press the StepCrumb button. Then work the way you always do.', 'art-dusk'],
  ['Click through', 'Every click, field and choice becomes a step: a screenshot, a highlight and plain words. Secrets are blurred as you go.', 'art-meadow'],
  ['Get everything', 'A guide, an SOP, a training module and a narrated video, all from those same clicks. Edit what you like, then export.', 'art-violet'],
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">How it works</p>
        <h2 className="display text-[44px] sm:text-[64px]">One click-through. Four deliverables.</h2>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {HOW.map(([t, d, art], i) => (
          <div key={t} className="group" data-reveal>
            <div className={`art ${art} grid aspect-[4/3] place-items-center rounded-[28px]`}>
              <span className="display text-[120px] text-white/90 transition-transform duration-500 group-hover:scale-110">{i + 1}</span>
            </div>
            <h3 className="mt-6 text-[22px] font-semibold">{t}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-soft">{d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
