import { gsap } from 'gsap'
import type { ReactNode } from 'react'
import { useLoop } from '../motion'

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-float ${className}`}>{children}</div>
}

function GuideDemo() {
  const ref = useLoop(() => {
    const tl = gsap.timeline({ repeat: -1 })
    tl.set('.g-row', { backgroundColor: '#f9fafb' }).set('.g-num', { scale: 1 })
    for (let i = 0; i < 4; i++) {
      tl.to(`.g-row-${i}`, { backgroundColor: '#fff7ed', duration: 0.3 })
      tl.fromTo(`.g-num-${i}`, { scale: 0.6 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, '<')
      tl.to('.g-zoom', { scale: [1.15, 1.6, 1.35, 1.8][i], x: [10, -40, 30, -20][i], y: [0, -20, 10, -30][i], duration: 0.8, ease: 'power3.inOut' }, '<')
      tl.to(`.g-row-${i}`, { backgroundColor: '#f9fafb', duration: 0.3 }, '+=0.9')
    }
    tl.to('.g-zoom', { scale: 1, x: 0, y: 0, duration: 0.8, ease: 'power3.inOut' })
    return tl
  })
  const rows = ['Click the “New contact” button', 'Type the full name', 'Pick the lifecycle stage', 'Click Save contact']
  return (
    <div ref={ref} className="art art-dusk aspect-[5/4] rounded-[28px] p-[7%]">
      <Panel className="h-full">
        <div className="flex h-full gap-3">
          <div className="w-1/2 space-y-2">
            <p className="text-[12px] font-semibold text-gray-900">Add a new contact</p>
            {rows.map((r, i) => (
              <div key={r} className={`g-row g-row-${i} flex items-center gap-2 rounded-lg p-2`}>
                <span className={`g-num g-num-${i} grid h-5 w-5 flex-none place-items-center rounded-full bg-orange-500 text-[10px] font-bold text-white`}>{i + 1}</span>
                <span className="text-[11px] leading-tight text-gray-700">{r}</span>
              </div>
            ))}
          </div>
          <div className="relative w-1/2 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <div className="g-zoom absolute inset-0 origin-center p-3">
              <div className="mb-2 h-2 w-1/2 rounded bg-gray-300" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="mb-3">
                  <div className="mb-1 h-1.5 w-1/3 rounded bg-gray-300" />
                  <div className={`h-5 rounded border ${i === 1 ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200' : 'border-gray-200 bg-white'}`} />
                </div>
              ))}
              <div className="h-5 w-1/2 rounded bg-indigo-500" />
            </div>
            <div className="absolute bottom-2 right-2 h-8 w-12 rounded border-2 border-white bg-gray-200 shadow">
              <div className="m-1 h-3 w-5 border border-orange-500" />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function DocDemo() {
  const ref = useLoop((r) => {
    const q = gsap.utils.selector(r)
    const tl = gsap.timeline({ repeat: -1 })
    for (const kind of ['sop', 'training'] as const) {
      tl.set(q('.d-line'), { scaleX: 0 })
      tl.call(() => {
        q('.d-tab').forEach((t) => t.classList.toggle('bg-ink', t.getAttribute('data-k') === kind))
        q('.d-tab').forEach((t) => t.classList.toggle('text-white', t.getAttribute('data-k') === kind))
        q('.d-title')[0].textContent = kind === 'sop' ? 'SOP: Add a new contact' : 'Training: Add a new contact'
        const heads = kind === 'sop' ? ['1. Purpose', '2. Scope', '3. Procedure', '4. Expected result'] : ['What you’ll learn', 'Walkthrough', 'Practice', 'Quiz']
        q('.d-head').forEach((h, i) => (h.textContent = heads[i]))
      })
      tl.from(q('.d-head'), { autoAlpha: 0, x: -10, duration: 0.3, stagger: 0.45 })
      tl.to(q('.d-line'), { scaleX: 1, duration: 0.35, stagger: 0.12, ease: 'power2.out' }, '<0.1')
      tl.fromTo(q('.d-pill'), { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, stagger: 0.1, ease: 'back.out(2)' }, '>-0.2')
      tl.to({}, { duration: 1.6 })
      tl.to(q('.d-pill'), { autoAlpha: 0, duration: 0.2 })
    }
    return tl
  })
  return (
    <div ref={ref} className="art art-meadow aspect-[5/4] rounded-[28px] p-[7%]">
      <Panel className="h-full">
        <div className="mb-3 flex items-center gap-1">
          {(['sop', 'training'] as const).map((k) => (
            <span key={k} data-k={k} className="d-tab rounded-full px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors">
              {k === 'sop' ? 'SOP' : 'Training'}
            </span>
          ))}
          <span className="ml-auto flex gap-1">
            {['PDF', 'Word'].map((p) => (
              <span key={p} className="d-pill rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {p}
              </span>
            ))}
          </span>
        </div>
        <p className="d-title display mb-3 text-[22px] leading-tight text-gray-900">SOP: Add a new contact</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mb-2.5">
            <p className="d-head mb-1 text-[11px] font-semibold text-gray-800" />
            <div className="d-line mb-1 h-1.5 w-[92%] origin-left rounded bg-gray-200" />
            <div className="d-line h-1.5 w-[70%] origin-left rounded bg-gray-200" />
          </div>
        ))}
      </Panel>
    </div>
  )
}

function VideoDemo() {
  const ref = useLoop(() => {
    const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power3.inOut' } })
    tl.set('.v-head', { left: '0%' }).set('.v-cam', { scale: 1, x: 0, y: 0 }).set('.v-cur', { x: 210, y: 140 }).set('.v-cap', { autoAlpha: 0 })
    tl.to('.v-head', { left: '100%', duration: 7, ease: 'none' }, 0)
    tl.to('.v-cur', { x: 70, y: 52, duration: 1 }, 0.3)
    tl.to('.v-cam', { scale: 1.8, x: 60, y: 30, duration: 1 }, 0.4)
    tl.to('.v-cap', { autoAlpha: 1, duration: 0.3 }, 1.2)
    tl.to('.v-cur', { x: 150, y: 95, duration: 1 }, 2.4)
    tl.to('.v-cam', { x: -30, y: -10, duration: 1.1 }, 2.4)
    tl.call(() => void 0, [], 3.4)
    tl.to('.v-cam', { scale: 1, x: 0, y: 0, duration: 1 }, 4.6)
    tl.to('.v-cap', { autoAlpha: 0, duration: 0.3 }, 4.8)
    tl.to({}, { duration: 1 }, 6)
    return tl
  })
  return (
    <div ref={ref} className="art art-ink aspect-[5/4] rounded-[28px] p-[7%]">
      <Panel className="flex h-full flex-col gap-3 bg-gray-900 p-3">
        <div className="relative flex-1 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 p-[6%]">
          <div className="relative h-full overflow-hidden rounded-lg bg-white">
            <div className="v-cam absolute inset-0 origin-center p-3">
              <div className="mb-3 h-2 w-1/3 rounded bg-gray-300" />
              <div className="mb-2 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-md bg-gray-100" />
                ))}
              </div>
              <div className="mb-2 h-5 w-2/3 rounded border border-gray-200" />
              <div className="h-5 w-1/3 rounded bg-indigo-500" />
              <svg className="v-cur absolute left-0 top-0 h-4 w-3" viewBox="0 0 18 27" aria-hidden>
                <path d="M0 0v23l6-5.5 4.5 9.5 4-1.8-4.3-9.2H18z" fill="#111827" stroke="#fff" strokeWidth="1.6" />
              </svg>
            </div>
            <div className="v-cap absolute inset-x-0 bottom-2 flex justify-center">
              <span className="rounded-md bg-gray-900/90 px-2 py-1 text-[10px] font-semibold text-white">Click the Save contact button</span>
            </div>
          </div>
        </div>
        <div className="relative h-9 rounded-lg bg-gray-800">
          <div className="absolute bottom-1.5 left-[6%] h-3 w-[40%] rounded bg-indigo-500/90" />
          <div className="absolute bottom-1.5 left-[62%] h-3 w-[26%] rounded bg-indigo-500/90" />
          {[8, 22, 35, 58, 70, 84].map((l, i) => (
            <span key={l} className="absolute top-1 h-2.5 w-2.5 rounded-full bg-orange-500" style={{ left: `${l}%` }} aria-label={`Step ${i + 1}`} />
          ))}
          <span className="v-head absolute inset-y-0 w-0.5 bg-red-500" />
        </div>
      </Panel>
    </div>
  )
}

function VoiceDemo() {
  const voices = ['Heart · US', 'Bella · US', 'Michael · US', 'Emma · UK', 'George · UK', 'Fenrir · US']
  const ref = useLoop((r) => {
    const q = gsap.utils.selector(r)
    const tl = gsap.timeline({ repeat: -1 })
    voices.forEach((_, i) => {
      tl.call(() => q('.vo-chip').forEach((c, j) => c.classList.toggle('vo-on', i === j)))
      tl.to(q('.vo-bar'), { scaleY: () => 0.15 + Math.random() * 0.85, duration: 0.16, stagger: { each: 0.015, from: 'center' }, repeat: 7, yoyo: true, ease: 'sine.inOut' })
    })
    return tl
  })
  return (
    <div ref={ref} className="art art-violet aspect-[5/4] rounded-[28px] p-[7%]">
      <Panel className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-gray-900">Voiceover</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Generated on this computer</span>
        </div>
        <div className="flex h-24 items-center justify-center gap-[3px]" aria-hidden>
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} className="vo-bar block h-full w-[4px] origin-center rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-500" style={{ transform: 'scaleY(.2)' }} />
          ))}
        </div>
        <p className="text-center text-[13px] italic text-gray-600">“Now click Save contact to store the record.”</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {voices.map((v) => (
            <span key={v} className="vo-chip rounded-full border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 transition-all [&.vo-on]:border-indigo-500 [&.vo-on]:bg-indigo-500 [&.vo-on]:text-white">
              {v}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  )
}

const FEATURES: { title: string; body: string; demo: ReactNode }[] = [
  {
    title: 'Guides that write themselves.',
    body: 'Every step gets a screenshot, a highlight on what you clicked and a plain-English instruction. Screenshots zoom in on the field you used, so readers can actually read it.',
    demo: <GuideDemo />,
  },
  {
    title: 'SOPs and training, ready to send.',
    body: 'Turn the same steps into a proper SOP (purpose, scope, procedure, revision history) or a training module with objectives, practice and a quiz. Export to PDF or Word.',
    demo: <DocDemo />,
  },
  {
    title: 'Videos that zoom where you click.',
    body: 'Record the tab while you work. StepCrumb adds a smooth cursor, zooms in on each click and back out between pages, and writes captions from your steps. Trim and tweak on a simple timeline.',
    demo: <VideoDemo />,
  },
  {
    title: 'A narrator, built in.',
    body: 'Your steps become a natural voiceover, made right on your computer, with no per-minute fees and no uploads. If a sentence runs long, the video waits for it.',
    demo: <VoiceDemo />,
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1100px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="mx-auto mb-16 max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">Features</p>
        <h2 className="display text-[44px] sm:text-[64px]">
          From clicks to <em>crystal clear</em>.
        </h2>
      </div>
      <div className="grid gap-x-12 gap-y-20 md:grid-cols-2">
        {FEATURES.map((f, i) => (
          <article key={f.title} className={i % 2 ? 'md:mt-40' : ''} data-reveal>
            {f.demo}
            <h3 className="mt-7 text-[24px] font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed text-soft">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
