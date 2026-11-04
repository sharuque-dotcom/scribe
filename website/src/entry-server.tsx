// Renders each page to HTML at build time (scripts/prerender.mjs), so search
// engines and AI crawlers that don't run JavaScript still read the full page.
import { renderToString } from 'react-dom/server'
import { App } from './App'
import { Legal } from './Legal'
import { Thanks } from './Thanks'
import { FAQS } from './sections/Bottom'

export type Page = 'home' | 'privacy' | 'terms' | 'thanks'

export function render(page: Page): string {
  return renderToString(page === 'thanks' ? <Thanks /> : page === 'home' ? <App /> : <Legal page={page} />)
}

export { FAQS }
