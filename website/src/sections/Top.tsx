import { useEffect, useState } from 'react'
import { CONFIG } from '../config'
import { HeroDemo } from './HeroDemo'
import { APPS, EdgeIcon } from './Logos'
import { CrumbMark } from './Crumbs'
import { HeroScene, SceneClick, SceneEverything, SceneStart } from './Scenes'

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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] bg-[radial-gradient(55%_50%_at_75%_10%,rgba(129,140,248,.22),transparent_70%),radial-gradient(40%_40%_at_15%_30%,rgba(249,115,22,.12),transparent_70%)]" />
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div className="text-center lg:text-left">
          <a href="#meet" className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[13px] font-medium text-soft shadow-sm backdrop-blur hover:text-ink" data-hero>
            <span className="rounded-full bg-ember px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
            Meet the Crumbs, your documentation crew →
          </a>
          <h1 className="display text-[52px] sm:text-[76px] lg:text-[84px]" data-hero>
            Show it once.
            <br />
            <span className="bg-gradient-to-r from-brand via-violet-500 to-ember bg-clip-text text-transparent">Explain it forever.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[18px] leading-relaxed text-soft sm:text-[20px] lg:mx-0" data-hero>
            Click through any task in your browser. The Crumbs follow every click and hand back a <b className="font-semibold text-ink">step-by-step guide</b>, an <b className="font-semibold text-ink">SOP</b>, a <b className="font-semibold text-ink">training module</b> and a <b className="font-semibold text-ink">narrated video</b>. Nothing you capture leaves your computer.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start" data-hero>
            <a href={CONFIG.chromeStoreUrl} className="btn-dark px-7 py-3.5 text-[16px]" data-crumb-look>
              <ChromeIcon /> Add to Chrome, it's free
            </a>
            <a href={CONFIG.checkoutUrl} className="btn-ghost px-7 py-3.5 text-[16px]" data-crumb-look>
              Lifetime access · ${CONFIG.founding.price}
            </a>
          </div>
          <p className="mt-4 text-[13px] text-soft" data-hero>
            Chrome & Edge · Windows, Mac, Linux, ChromeOS · No account needed
          </p>
        </div>
        <div data-hero>
          <HeroScene />
        </div>
      </div>
      <div className="mt-14" data-hero>
        <Strip />
      </div>
      <div className="mx-auto mt-14 max-w-[1180px] px-3 sm:px-8" data-hero>
        <HeroDemo />
      </div>
    </section>
  )
}

export function Strip() {
  return (
    <section className="border-y border-line py-7" aria-label="Works on the apps you already use">
      <p className="eyebrow mb-5 px-5 text-center">Works on the apps your team already uses</p>
      <div className="relative overflow-hidden">
        <ul className="marquee flex w-max items-center gap-12">
          {[...APPS, ...APPS].map((a, i) => (
            <li key={i} className="group flex items-center gap-2.5 whitespace-nowrap" aria-hidden={i >= APPS.length}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 grayscale opacity-60 transition duration-300 group-hover:opacity-100 group-hover:grayscale-0" role="img" aria-label={a.name}>
                <path d={a.d} fill={a.color} />
              </svg>
              <span className="text-[17px] font-semibold tracking-tight text-ink/55 transition-colors duration-300 group-hover:text-ink">{a.name}</span>
            </li>
          ))}
        </ul>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
      </div>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-5 text-center text-[13px] text-soft">
        Works on any website you can open in
        <span className="inline-flex items-center gap-1 font-semibold text-ink">
          <ChromeIcon className="h-4 w-4" /> Chrome
        </span>
        or
        <span className="inline-flex items-center gap-1 font-semibold text-ink">
          <EdgeIcon className="h-4 w-4" /> Edge.
        </span>
      </p>
      <p className="mt-1 text-center text-[11px] text-soft/70">Product names and logos belong to their owners and don't imply endorsement.</p>
    </section>
  )
}

const HOW = [
  ['Press Start', 'Open the site you want to explain and press the StepCrumb button. Then work the way you always do.', SceneStart],
  ['Click through', 'Every click, field and choice becomes a step: a screenshot, a highlight and plain words. Shh blurs anything private as you go.', SceneClick],
  ['Get everything', 'A guide, an SOP, a training module and a narrated video, all from those same clicks. Edit what you like, then export.', SceneEverything],
] as const

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4 inline-flex items-center gap-3"><CrumbMark className="h-4 w-10" />How it works</p>
        <h2 className="display text-[44px] sm:text-[64px]">Three steps. Four results.</h2>
        <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-soft">Press Start, click through as usual, and the Crumbs hand back a guide, an SOP, a training module and a narrated video.</p>
      </div>
      <div className="relative mt-16 grid gap-6 md:grid-cols-3">
        <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-[-29px] hidden h-[3px] bg-[radial-gradient(circle,rgba(21,20,18,.35)_1.2px,transparent_1.6px)] bg-[length:9px_3px] md:block" aria-hidden />
        {HOW.map(([t, d, Scene], i) => (
          <div key={t} className="group relative" data-reveal>
            <span className={`absolute left-1/2 top-[-38px] z-10 hidden h-5 w-5 -translate-x-1/2 rounded-full ring-4 ring-paper md:block ${i === 1 ? 'bg-[#818CF8]' : 'bg-ember'}`} aria-hidden />
            <Scene />
            <h3 className="mt-6 flex items-center gap-3 text-[22px] font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[14px] text-paper">{i + 1}</span>
              {t}
            </h3>
            <p className="mt-2 text-[16px] leading-relaxed text-soft">{d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
