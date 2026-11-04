// After `vite build` and the SSR build, fills each page's <div id="root"> with
// its rendered HTML and adds the FAQ structured data to the homepage.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const { render, FAQS } = await import(resolve(root, 'dist-ssr/entry-server.js'))

const pages = { home: 'index.html', privacy: 'privacy.html', terms: 'terms.html', thanks: 'thanks.html' }
for (const [page, file] of Object.entries(pages)) {
  const path = resolve(root, 'dist', file)
  let html = readFileSync(path, 'utf8')
  const re = /(<div id="root"[^>]*>)(<\/div>)/
  if (!re.test(html)) throw new Error(`no empty root in ${file}`)
  html = html.replace(re, (_, open, close) => open + render(page) + close)
  if (page === 'home') {
    const faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }
    html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(faq).replace(/</g, '\\u003c')}</script>\n  </head>`)
  }
  writeFileSync(path, html)
  console.log(`prerendered ${file} (${Math.round(html.length / 1024)} kB)`)
}
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true })
