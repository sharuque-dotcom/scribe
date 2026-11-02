# StepCrumb website

The product page for stepcrumb.com. Vite + React + Tailwind, with GSAP for the animations.

```bash
cd website
npm install
npm run dev      # local preview
npm run build    # static site in website/dist
```

Before launch, edit `src/config.ts`:

- `checkoutUrl`: the Lemon Squeezy checkout link for the Founding 1,000 product. Buttons with the
  `lemonsqueezy-button` class open it as an overlay (lemon.js is loaded in `index.html`).
- `chromeStoreUrl` / `edgeStoreUrl`: the store listings once published.
- `foundingSold`: set to the real number sold to show the "x of 1,000 left" bar (hidden while `null`).

Pages: `index.html` (product page), `privacy.html`, `terms.html`. The privacy policy and terms are
plain-language starting points and should be reviewed before launch.

Deploy on Vercel with **Root Directory** set to `website` (framework: Vite). Then add the
`stepcrumb.com` domain in Vercel and create the DNS records it shows at your domain registrar.
