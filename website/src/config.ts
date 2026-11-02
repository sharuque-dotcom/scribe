// Edit these before launch.
export const CONFIG = {
  // Lemon Squeezy checkout link for the Founding 1,000 product (opens as an overlay).
  checkoutUrl: 'https://stepcrumb.lemonsqueezy.com/checkout/buy/REPLACE-ME',
  // Chrome Web Store / Edge Add-ons listing (until published, point to a waitlist or the zip).
  chromeStoreUrl: '#install',
  edgeStoreUrl: '#install',
  founding: { price: 49, limit: 1000 },
  // How many founding licenses are sold. Leave null to hide the counter
  // (only show a real number).
  foundingSold: null as number | null,
  pro: { monthly: 8, yearly: 69 },
  contactEmail: 'hello@stepcrumb.com',
}
