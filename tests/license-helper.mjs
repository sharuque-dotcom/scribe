// Test helpers: a fake Lemon Squeezy license server, and activating a key
// through the editor's Settings dialog, so tests can check free and paid modes.
export const TEST_KEY = 'TEST-1234-ABCD'

export async function fakeLicenseServer(ctx) {
  const calls = []
  await ctx.route('https://api.lemonsqueezy.com/**', async (route) => {
    const req = route.request()
    const params = new URLSearchParams(req.postData() ?? '')
    calls.push({ path: new URL(req.url()).pathname, key: params.get('license_key') })
    const meta = { store_id: 1, product_id: 1, product_name: 'StepCrumb', variant_name: 'Founding 1,000', customer_email: 'test@example.com' }
    const good = params.get('license_key') === TEST_KEY
    const body = req.url().endsWith('/activate')
      ? good
        ? { activated: true, error: null, license_key: { status: 'active', key: TEST_KEY }, instance: { id: 'inst-test' }, meta }
        : { activated: false, error: 'license_key not found.' }
      : { valid: good, error: good ? null : 'license_key not found.', license_key: { status: 'active', key: TEST_KEY }, instance: { id: 'inst-test' }, meta }
    await route.fulfill({ status: good ? 200 : 404, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  return calls
}

// Opens Settings from the plan badge, tries a wrong key, then the right one.
export async function activateInSettings(page, check) {
  await page.getByRole('button', { name: 'Free · Upgrade' }).click()
  await page.getByLabel('License key').fill('WRONG-KEY')
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByRole('alert').filter({ hasText: 'not found' }).waitFor()
  check(true, 'a wrong license key shows the error from the license server')
  await page.getByLabel('License key').fill(TEST_KEY)
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByText('StepCrumb Founding 1,000 · active').waitFor()
  check(true, 'license activates and shows the plan name')
  check((await page.getByText('Licensed to test@example.com').count()) === 1, 'Settings shows who the license belongs to')
  check((await page.getByRole('button', { name: /Remove license/ }).count()) === 0, 'no self-service button to pass the key on')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Founding 1,000' }).first().waitFor()
}
