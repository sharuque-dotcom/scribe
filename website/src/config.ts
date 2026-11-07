// Edit these before launch.
export const CONFIG = {
  // Polar checkout: Lifetime, Monthly and Yearly on one page.
  checkoutUrl: 'https://buy.polar.sh/polar_cl_ImqGIEAjftim5l45evDJ9hyB5WhthHn6747Pn1IkbMt',
  // The Chrome Web Store listing. Edge installs from it too ("Allow extensions from other stores").
  chromeStoreUrl: 'https://chromewebstore.google.com/detail/stepcrumb/mlhgnmpcjpbiobhkpcholmipmgmjiphj',
  edgeStoreUrl: 'https://chromewebstore.google.com/detail/stepcrumb/mlhgnmpcjpbiobhkpcholmipmgmjiphj',
  founding: { price: 49, limit: 1000 },
  // How many founding licenses are sold. Leave null to hide the counter
  // (only show a real number).
  foundingSold: null as number | null,
  pro: { monthly: 8, yearly: 69 },
  contactEmail: 'hello@stepcrumb.com',
  // Where customers see their key, invoices and computers, and manage subscriptions.
  portalUrl: 'https://polar.sh/stepcrumb/portal',
}
