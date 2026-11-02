// Edit these before launch.
export const CONFIG = {
  // Polar checkout: Lifetime, Monthly and Yearly on one page.
  checkoutUrl: 'https://buy.polar.sh/polar_cl_ImqGIEAjftim5l45evDJ9hyB5WhthHn6747Pn1IkbMt',
  // Chrome Web Store / Edge Add-ons listing (until published, point to a waitlist or the zip).
  chromeStoreUrl: '#install',
  edgeStoreUrl: '#install',
  founding: { price: 49, limit: 1000 },
  // How many founding licenses are sold. Leave null to hide the counter
  // (only show a real number).
  foundingSold: null as number | null,
  pro: { monthly: 8, yearly: 69 },
  contactEmail: 'hello@stepcrumb.com',
  // Where customers see their key, invoices and computers, and manage subscriptions.
  portalUrl: 'https://polar.sh/stepcrumb/portal',
}
