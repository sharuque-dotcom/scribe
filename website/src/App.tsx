import { gsap } from 'gsap'
import { useEffect } from 'react'
import { reducedMotion, useReveal } from './motion'
import { Compare, Faq, FinalCta, Footer, Founder, Pricing, Privacy, UseCases } from './sections/Bottom'
import { Features } from './sections/Features'
import { Hero, HowItWorks, Nav, Strip } from './sections/Top'
import { TrailDivider, useCrumbClicks } from './sections/Crumbs'
import { useCrumbEyes } from './sections/Cast'
import { MeetTheCrumbs } from './sections/Scenes'

export function App() {
  useReveal()
  useCrumbClicks()
  useCrumbEyes()
  useEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from('[data-hero]', { autoAlpha: 0, y: 30, filter: 'blur(8px)', duration: 1, ease: 'power3.out', stagger: 0.09, delay: 0.1 })
    })
    return () => ctx.revert()
  }, [])
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <div className="mt-20">
          <Strip />
        </div>
        <MeetTheCrumbs />
        <HowItWorks />
        <TrailDivider />
        <Features />
        <UseCases />
        <Privacy />
        <TrailDivider color="#818CF8" />
        <Compare />
        <Pricing />
        <Faq />
        <Founder />
        <TrailDivider />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
